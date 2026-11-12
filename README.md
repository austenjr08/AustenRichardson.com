Hi! My name is Austen Richardson. If you're here, you probably already found the site, so this will be purely about the site.

This was coded in HTML, CSS, and JavaScript. 

The star in the middle is my About page, and each of the eight planets is one of my projects. Everything moves under real orbital physics, and you can grab the planets and throw them around.

## Features

- **Real orbital mechanics.** The planets orbit the star under Newtonian gravity and follow Kepler's laws. Distances are compressed, but the physics is real: inner planets move faster, and orbits keep their true eccentricities.
- **Today's sky.** When the page loads, each planet starts where it actually is in its orbit today, calculated from real J2000 orbital elements.
- **Fling a planet.** Drag a planet and let go to throw it. Your throw is capped below escape velocity, so the planet always stays bound and gets pulled back.
- **Supernova.** Throw a planet into the star and the star swallows it, collapses and explodes. The remnant becomes a pulsar, the planets lose their orbits and bounce around the screen, and a reset button appears after a few seconds.
- **The rogue comet.** A comet flies through on a hyperbolic orbit every 30 seconds, with its tail always pointing away from the star. Catch it to find a hidden page.
- **Project pages.** Each planet opens a page for one of my projects. The star opens my About page.

## How it works

- **Integrator.** Planets are moved with a leapfrog (kick-drift-kick) integrator, which conserves energy well, so orbits don't spiral in or out over time. Each body takes smaller steps when it's close to the star.
- **Scale.** Gravity is set so Mercury completes an orbit in about 6 seconds. Every other planet's period follows from Kepler's third law.
- **Starting positions.** Each planet's position is calculated from its mean longitude and eccentricity by solving Kepler's equation with Newton's method.
- **Throw cap.** Before a throw is applied, the code uses the vis-viva equation to find how far out the new orbit would reach. If it would go past the edge of the system, it shrinks the throw speed (by bisection) until it fits.
- **Rendering.** Everything is drawn on an HTML5 canvas. Each planet sprite is drawn once and reused every frame, and a lit side faces the star.
