"""Small opt-in, normalized profile images; never trust filenames or supplied MIME."""
import base64
import binascii
import json
import asyncio
from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool
from app.database import get_db
from app.models import ProfilePhoto, User
from app.services.auth_service import get_current_user
from app.services.request_limits import throttle

router = APIRouter(prefix='/profile/me/photo', tags=['Profile photos'])
decode_slots = asyncio.Semaphore(2)


def normalized_photo(encoded):
    if not isinstance(encoded,str) or len(encoded)>1400000: raise HTTPException(413,'Photo must be at most 1 MB')
    try:
        raw=base64.b64decode(encoded,validate=True)
        if len(raw)>1024*1024: raise HTTPException(413,'Photo must be at most 1 MB')
        with Image.open(BytesIO(raw)) as original:
            if original.format not in ('PNG','JPEG') or original.width*original.height>4000000:
                raise HTTPException(422,'Choose a JPEG or PNG up to 4 megapixels')
            original.load()
            image=ImageOps.exif_transpose(original).convert('RGB')
            image.thumbnail((512,512))
            output=BytesIO();image.save(output,format='JPEG',quality=85)
            return output.getvalue() # No EXIF/GPS metadata or original file is retained.
    except (binascii.Error,UnidentifiedImageError,OSError,ValueError,Image.DecompressionBombError):
        raise HTTPException(422,'Choose a valid JPEG or PNG image') from None


@router.put('',status_code=204)
async def upload(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    throttle(db,'profile-photo',user.id,10)
    data=bytearray()
    async for chunk in request.stream():
        if len(data)+len(chunk)>1500000: raise HTTPException(413,'Photo request is too large')
        data.extend(chunk)
    try: encoded=json.loads(data)['base64']
    except (ValueError,KeyError,TypeError): raise HTTPException(422,'Provide the image base64 field') from None
    async with decode_slots:
        image=await run_in_threadpool(normalized_photo, encoded)
    photo=db.get(ProfilePhoto,user.id)
    if photo is None: photo=ProfilePhoto(user_id=user.id);db.add(photo)
    photo.image=image;db.commit()
    return Response(status_code=204)


@router.get('')
def read(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    photo=db.get(ProfilePhoto,user.id)
    return {'base64':base64.b64encode(photo.image).decode() if photo else None,
            'media_type':'image/jpeg'}


@router.delete('',status_code=204)
def remove(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(ProfilePhoto).filter_by(user_id=user.id).delete();db.commit()
    return Response(status_code=204)
