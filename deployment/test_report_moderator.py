import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import importlib.util
spec=importlib.util.spec_from_file_location('grant_report_moderator',Path(__file__).resolve().parents[1]/'backend/scripts/grant_report_moderator.py')
helper=importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class ModeratorGrantTests(unittest.TestCase):
    def test_ids_reject_malformed_values_and_deduplicate(self):
        self.assertEqual(helper.moderator_ids('1,2,1'),{1,2})
        self.assertEqual(helper.moderator_ids(''),set())
        for value in ('0','1,','-2','name@example.test','1\nEnvironment=X','１'):
            with self.assertRaises(ValueError):helper.moderator_ids(value)

    def test_lookup_requires_a_running_release_and_one_id(self):
        with patch.object(helper,'run',side_effect=['/opt/team43/releases/release/backend','3']) as run:
            self.assertEqual(helper.resolve_account('test@example.test'),3)
            self.assertEqual(run.call_args.args[-1],'test@example.test')
            self.assertIn('WHERE u.email=%s',run.call_args.args[-2])
        with patch.object(helper,'run',return_value='/tmp/backend'):
            with self.assertRaises(RuntimeError):helper.resolve_account('test@example.test')

    def test_failed_verification_restores_previous_override(self):
        with tempfile.TemporaryDirectory() as directory:
            target=Path(directory)/'moderation.conf';target.write_text('previous')
            with patch.object(helper,'STATE',Path(directory)),patch.object(helper,'DROPIN',target),patch.object(helper,'live_ids',side_effect=[{2},set()]),patch.object(helper,'run'),patch.object(helper,'write_dropin') as write,patch.object(helper.urllib.request,'urlopen') as request:
                request.return_value.__enter__.return_value.status=200
                with self.assertRaises(RuntimeError):helper.install(3)
                self.assertIn('2,3',write.call_args_list[0].args[0])
                self.assertEqual(write.call_args_list[-1].args[0],'previous')


if __name__=='__main__':unittest.main()
