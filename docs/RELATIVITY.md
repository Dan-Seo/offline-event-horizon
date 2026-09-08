# Following light through a Schwarzschild horizon

VASTNESS 2.2 adds an optional, idealized general-relativistic observation at **The Wound**. It is separate from the existing softened Newtonian test-particle experiment and from the artistic black-hole mesh used during ordinary flight. The application does not claim to reproduce an observed black-hole interior.

## Observer and coordinates

The model is the Schwarzschild vacuum: spherical, nonrotating, uncharged, with negligible source/disk mass. Set the Schwarzschild radius `r_s = 2GM/c²` and `c` to one. The horizon is at `r=1`, the photon sphere at `r=1.5`, and the innermost stable circular timelike orbit at `r=3`.

Use ingoing Painlevé–Gullstrand coordinates for the observer:

```text
ds² = -(1-1/r)dT² + 2 sqrt(1/r)dT dr + dr² + r² dΩ²
u = (1, -sqrt(1/r), 0, 0)
e_r = (0, 1, 0, 0)
```

This radial observer has specific energy `E=1`, corresponding to free fall from rest at infinity. The application begins observing partway along that trajectory; it does not release a stationary observer from the starting radius.

```text
r(τ) = [r_start^(3/2) - 3τ/2]^(2/3)
remaining proper time = 2r^(3/2)/3
future radial null slopes dr/dT = -sqrt(1/r) ± 1
local tidal eigenvalues = (1, -1/2, -1/2) / r³
```

The horizon is crossed continuously in finite proper time, with no artificial flash. Both future radial light directions point toward decreasing radius inside it. The tidal values describe geodesic deviation per unit separation in units `c²/r_s²`; the panel displays radial stretching divided by its value at the horizon. It does not simulate a human body.

The visible clock is proper time in units `r_s/c`. Presentation time is deliberately slowed near the center; the × playback control is not a change to gravity. No mass is selected, so displayed times are dimensionless, not seconds for a particular astrophysical black hole.

## Light rays

Each fragment initializes a past-directed photon of unit local frequency in the observer's orthonormal frame. For outward radial unit vector `R`, local sight direction `n`, and `v=sqrt(1/r)`:

```text
k = -u + n^i e_i
x = r R
x' = n + v R
E_ray = -1 - v dot(n, R)
L = cross(x, x')
```

The spatial null geodesic has the exact pseudo-Cartesian form

```text
x'' = -(3/2) |L|² x / |x|⁵
|x'|² - |L|² / r³ = E_ray²
```

Primes denote an affine parameter, not Newtonian time. This equation follows by differentiating the Schwarzschild null radial effective-potential equation and using conservation of angular momentum. Its central-force appearance does not make it a Newtonian gravity simulation.

`relativity.ts` integrates it with an adaptive-step RK4 shader. `relativity-model.ts` provides the CPU reference and the analytic observer clock. The current camera direction belongs to the user; dragging changes the local sight directions, including after crossing the horizon. Translation or Esc ends the observation and restores the saved exterior flight position. That restoration is an application reset, not a physical escape from a black hole.

## Light sources and frequency transfer

The source model is stationary: an opaque, geometrically thin disk from `3` to `9 r_s`, and a distant procedural sky treated as an infinity source. The disk follows circular Keplerian motion. The first disk-plane intersection along a ray supplies its emission. For the past-directed ray convention above:

```text
Ω = sqrt(1 / (2 r_em³))
g = observed frequency / emitted frequency
  = sqrt(1 - 1.5/r_em) / (-E_ray + Ω L_axis)
I_observed = g⁴ I_emitted              [bolometric intensity]
```

The sky uses `g=1/(-E_ray)` for rays arriving from the chosen exterior infinity. Ray integration ends at radius `90`; its outgoing tangent approximates the asymptotic direction. Emission-time delays are not integrated because neither source varies with time. The radial emissivity profile, banding, source colors, RGB temperature mapping, and photographic exposure are designed illustrations. Radiance and frequency gains are clipped for a finite display. This is not a calibrated spectrum or a full relativistic disk-radiation calculation.

## Numerical and rendering limits

- Maximum 480 RK4 steps; `h = 0.06 r / max(0.2, |x'|, 2 sqrt(L²/r³))`.
- Rays terminate at `r<0.04`, at the approximate infinity boundary, or at the step budget. Unresolved or unilluminated rays are black. Very high-order images near the critical curve can be truncated.
- Observation stops at `r=0.2`. This is a chosen application limit, not a quantum-gravity threshold or another physical surface. No image of the `r=0` singularity is invented.
- The observer lens is 106° vertically. Render-width caps are 1440 / 1200 / 900 / 600 pixels for Ultra / High / Balanced / Battery. The half-float color target is upscaled to the canvas. Very thin rings can alias.
- The GPU uses float32 arithmetic; the CPU reference uses JavaScript float64. CPU convergence tests do not certify every GPU pixel. A linear segment approximates the disk-plane crossing within each integration step.
- No Kerr spin, charged interior, collapse history, disk self-gravity, GRMHD, spectral radiative transfer, Hawking radiation, or quantum singularity model. The stationary source boundary omits white-hole illumination and does not model the surface of a collapsing star.

## Verification

`npm test` checks the analytic horizon crossing, null-cone signs, trace-free tides, local null normalization on both sides of the horizon, a circular photon orbit, the critical impact parameter, incoming exterior light inside, and disk frequency transfer. A 366-ray fixture grid compares escape classification and asymptotic direction with four-times-finer integration. Escaping fixtures must preserve the normalized energy invariant within `2.5e-4` and converge in direction within `0.002 rad` (about 0.12°). This grid is a regression/convergence check, not an exhaustive mathematical error bound.

`npm run qa:approaches` operates the real renderer through installed Chrome and actual UI, keyboard, and drag input. It checks initialization, proper-time pause, horizon crossing, view control, numerical stop, recovery, viewport layout, and continuous flights into five regional planetary environments. It never teleports the camera or injects simulation state. `QA_BACKEND=webgl` exercises the WebGL2 path. `?qa=1&profile=1` optionally exposes renderer timestamp-query measurements where the WebGPU backend supports them; normal operation performs no such readback.

## Primary references

- [Hamilton & Lisle, _The river model of black holes_](https://arxiv.org/abs/gr-qc/0411060): freely falling frames and horizon-regular interpretation.
- [Müller & Frauendiener, _Interactive visualization of a thin disc around a Schwarzschild black hole_](https://arxiv.org/abs/1206.4259): null-geodesic disk imaging, circular emitters, and intensity transfer. Their analytic GPU method is different from this implementation's numerical infaller ray tracing.
- [Andrew Hamilton, JILA: _Inside a Schwarzschild black hole_](https://jila.colorado.edu/~ajsh/insidebh/schw.html): visual expectations at the photon sphere, horizon, and interior, and the distinction between falling and hovering observers.
