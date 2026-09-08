"""Analytic fixtures verify coordinate conventions; these are not captured data."""
import importlib.util
import math
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('audit', Path(__file__).parents[1]/'scripts/reconstruction_report.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ReconstructionAudit(unittest.TestCase):
    def test_world_to_camera_rotation_and_translation(self):
        point = module.transform([math.sqrt(.5), 0, math.sqrt(.5), 0], [0, 0, 5], [1, 2, 0])
        for actual, expected in zip(point, [0, 2, 4]):
            self.assertAlmostEqual(actual, expected)
        self.assertEqual(module.project('PINHOLE', [100, 200, 50, 60], [2, 1, 4]), (100, 110))

    def test_sparse_ids_empty_observations_and_known_pixel_residual(self):
        with tempfile.TemporaryDirectory() as directory:
            d = Path(directory)
            (d/'cameras.txt').write_text('7 SIMPLE_PINHOLE 100 100 100 50 50\n')
            (d/'images.txt').write_text('9 1 0 0 0 0 0 0 7 first.jpg\n51 50 500\n20 1 0 0 0 0 0 0 7 empty image.jpg\n\n')
            (d/'points3D.txt').write_text('500 0 0 2 255 255 255 1 9 0\n')
            report = module.audit(d, 4)
            self.assertEqual(report['registered_images'], 2)
            self.assertEqual(report['registration_fraction'], .5)
            self.assertEqual(report['reprojection_pixels']['median'], 1)
            self.assertEqual(report['track_length']['mean'], 1)

    def test_radial_distortion_and_rejected_camera_model(self):
        pixel = module.project('SIMPLE_RADIAL', [100, 0, 0, .1], [1, 0, 1])
        self.assertAlmostEqual(pixel[0], 110)
        self.assertAlmostEqual(pixel[1], 0)
        self.assertIsNone(module.project('PINHOLE', [1, 1, 0, 0], [0, 0, -1]))
        with self.assertRaises(ValueError):
            module.project('FISHEYE', [], [0, 0, 1])


if __name__ == '__main__':
    unittest.main()
