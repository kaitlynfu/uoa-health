import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function editor(request=async()=>({milestones:[]})){
    const states=[];let cursor=0;const jsx=(type,props)=>({type,props:props??{}});
    const module={exports:{}};
    function require(name){
        if(name==='react')return {useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next;}];}};
        if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};
        if(name==='react-native')return Object.fromEntries(['KeyboardAvoidingView','Modal','Pressable','ScrollView','Text','TextInput','View'].map(name=>[name,name]).concat([['Platform',{OS:'ios'}],['StyleSheet',{create:s=>s}]]));
        if(name==='react-native-safe-area-context')return {SafeAreaView:'SafeAreaView'};
        if(name.endsWith('/studentApi'))return {studentRequest:request};
        throw Error(name);
    }
    const source=readFileSync(new URL('../components/MilestoneCourseEditor.tsx',import.meta.url),'utf8');
    vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require,Error});
    return props=>{cursor=0;return module.exports.default(props);};
}
function nodes(tree){if(tree==null||typeof tree==='boolean')return [];if(Array.isArray(tree))return tree.flatMap(nodes);if(typeof tree!=='object')return [tree];return [tree,...nodes(tree.props?.children)];}
const text=tree=>nodes(tree).filter(n=>typeof n==='string').join(' ');
function button(tree,label){const result=nodes(tree).find(n=>n?.props?.onPress&&text(n)===label);assert.ok(result,'Missing '+label);return result;}
function input(tree,label){const result=nodes(tree).find(n=>n?.type==='TextInput'&&n.props.accessibilityLabel===label);assert.ok(result);return result;}
const milestone={id:8,title:'Stage I elective',original_title:'Stage I elective',code:'PLAN:S1_ELECTIVE_A',completed:true,points:15};

test('course editor saves trimmed personal labels without sending points or completion',async()=>{
    const requests=[];const result={milestones:[{...milestone,title:'Chosen course'}]};let saved;
    const render=editor(async(...args)=>{requests.push(args);return result;});
    const props={milestone,token:'private-session',onClose(){},onSaved:j=>{saved=j;}};
    let tree=render(props);input(tree,'Course name').props.onChangeText('  Chosen course  ');input(tree,'Course code (optional)').props.onChangeText(' chem 110 ');
    tree=render(props);await button(tree,'Save course').props.onPress();
    assert.equal(requests[0][0],'/journey/me/milestones/8');assert.equal(requests[0][1],'private-session');assert.equal(requests[0][2],'PATCH');
    assert.deepEqual(JSON.parse(JSON.stringify(requests[0][3])),{custom_title:'Chosen course',custom_course_code:'CHEM 110'});assert.equal(saved,result);
});
test('blank course names stay editable and do not send a request',async()=>{
    let calls=0;const render=editor(async()=>{calls++;});const props={milestone,token:'x',onClose(){},onSaved(){}};
    input(render(props),'Course name').props.onChangeText('  ');await button(render(props),'Save course').props.onPress();
    assert.equal(calls,0);assert.match(text(render(props)),/Enter a course name/);
});
test('failed saves retain the entered name, allow retry and cancel without saving',async()=>{
    let calls=0,closed=false;const render=editor(async()=>{calls++;throw Error('Offline. Retry.');});const props={milestone,token:'x',onClose(){closed=true;},onSaved(){assert.fail('Should not save');}};
    input(render(props),'Course name').props.onChangeText('My course');await button(render(props),'Save course').props.onPress();
    const tree=render(props);assert.match(text(tree),/Offline/);assert.equal(input(tree,'Course name').props.value,'My course');assert.equal(button(tree,'Save course').props.disabled,false);
    button(tree,'Cancel').props.onPress();assert.equal(closed,true);assert.equal(calls,1);
});
test('restore clears both labels while the original template remains visible',async()=>{
    let payload;const render=editor(async(_path,_token,_method,body)=>{payload=body;return {};});
    const props={milestone:{...milestone,title:'My chemistry',custom_title:'My chemistry',custom_course_code:'CHEM 110'},token:'x',onClose(){},onSaved(){}};
    const tree=render(props);assert.match(text(tree),/Original milestone:\s+Stage I elective/);await button(tree,'Restore original label').props.onPress();
    assert.deepEqual(JSON.parse(JSON.stringify(payload)),{custom_title:null,custom_course_code:null});
});
