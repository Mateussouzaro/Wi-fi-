const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto('http://localhost:8777/render_pose.html');
  await p.waitForFunction('window.ready===true', null, { timeout: 60000 });
  const shots = { frente: [[0, 5, -22], [0, 2.5, 0], 60], lado: [[24, 4, 2], [0, 2.5, 0], 60], tres4: [[-14, 6, -16], [0, 2.5, 0], 60] };
  for (const [n, [pos, look, fov]] of Object.entries(shots)) {
    await p.evaluate(([a, c, f]) => window.shot(a, c, f), [pos, look, fov]);
    await p.screenshot({ path: `pose_${n}.png` });
  }
  await b.close();
})();
