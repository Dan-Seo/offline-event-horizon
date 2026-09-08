"""Audit a COLMAP text reconstruction without changing it.

No reconstruction algorithm is claimed here. This is a small independent
reprojection and provenance check for a future personally captured asset.
Format: https://colmap.github.io/format.html
"""
import argparse
import hashlib
import json
import math
from pathlib import Path


def records(path):
    return [line.split() for line in path.read_text(encoding='utf-8').splitlines()
            if line.strip() and not line.lstrip().startswith('#')]


def project(model, params, xyz):
    x, y, z = xyz
    if z <= 0:
        return None
    x, y = x / z, y / z
    if model == 'PINHOLE':
        fx, fy, cx, cy = params
    elif model in ('SIMPLE_PINHOLE', 'SIMPLE_RADIAL', 'RADIAL'):
        fx, cx, cy = params[:3]
        fy = fx
        r2 = x*x + y*y
        distortion = 1
        if model != 'SIMPLE_PINHOLE':
            distortion += params[3] * r2
        if model == 'RADIAL':
            distortion += params[4] * r2*r2
        x, y = x * distortion, y * distortion
    else:
        raise ValueError(f'Unsupported camera model {model}; export undistorted PINHOLE cameras.')
    return fx*x + cx, fy*y + cy


def transform(q, t, p):
    norm = math.sqrt(sum(v*v for v in q))
    if norm < 1e-10:
        raise ValueError('Invalid zero quaternion')
    w, x, y, z = [v / norm for v in q]
    r = ((1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)),
         (2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)),
         (2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)))
    return tuple(sum(row[j]*p[j] for j in range(3)) + t[i] for i, row in enumerate(r))


def summary(values):
    if not values:
        return None
    v = sorted(values)
    def percentile(q):
        at = (len(v)-1)*q
        lo = int(at)
        return v[lo] + (v[min(lo+1, len(v)-1)]-v[lo])*(at-lo)
    return dict(count=len(v), mean=sum(v)/len(v), median=percentile(.5), p95=percentile(.95), maximum=v[-1])


def audit(folder, input_images=None):
    folder = Path(folder)
    cameras = {int(row[0]): (row[1], list(map(float, row[4:]))) for row in records(folder/'cameras.txt')}
    points = {int(row[0]): list(map(float, row[1:4])) for row in records(folder/'points3D.txt')}
    point_rows = records(folder/'points3D.txt')
    track_lengths = [(len(row)-8)//2 for row in point_rows]
    errors, behind, linked, registered = [], 0, 0, 0
    lines = iter((folder/'images.txt').read_text(encoding='utf-8').splitlines())
    for line in lines:
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        row = line.split(maxsplit=9)
        if len(row) != 10:
            raise ValueError('Malformed image pose record')
        q = list(map(float, row[1:5])); t = list(map(float, row[5:8]))
        model, params = cameras[int(row[8])]
        observations = next(lines, None)
        while observations is not None and observations.lstrip().startswith('#'):
            observations = next(lines, None)
        if observations is None:
            raise ValueError('Missing image observation line')
        values = observations.split()
        if len(values) % 3:
            raise ValueError('Malformed observation triplets')
        registered += 1
        for i in range(0, len(values), 3):
            pid = int(values[i+2])
            if pid == -1:
                continue
            if pid not in points:
                raise ValueError(f'Observation references absent point {pid}')
            linked += 1
            pixel = project(model, params, transform(q, t, points[pid]))
            if pixel is None:
                behind += 1
            else:
                error = math.hypot(pixel[0]-float(values[i]), pixel[1]-float(values[i+1]))
                if not math.isfinite(error):
                    raise ValueError('Non-finite reprojection')
                errors.append(error)
    if not errors:
        raise ValueError('No valid linked observations to evaluate')
    if input_images is not None and input_images < registered:
        raise ValueError('Input image count cannot be below registered image count')
    return {
        'description': 'Independent reprojection audit of supplied COLMAP output; not ground-truth accuracy',
        'registered_images': registered, 'input_images': input_images,
        'registration_fraction': registered/input_images if input_images else None,
        'sparse_points': len(points), 'linked_observations': linked,
        'behind_camera_observations': behind, 'reprojection_pixels': summary(errors),
        'track_length': summary(track_lengths),
        'source_sha256': {name: hashlib.sha256((folder/name).read_bytes()).hexdigest()
                          for name in ('cameras.txt', 'images.txt', 'points3D.txt')},
        'limits': 'No metric scale, held-out image evaluation, completeness estimate, or SLAM trajectory accuracy.',
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('model', type=Path)
    parser.add_argument('--input-images', type=int)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = audit(args.model, args.input_images)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, allow_nan=False)+'\n', encoding='utf-8')
    print(json.dumps(result, indent=2))
