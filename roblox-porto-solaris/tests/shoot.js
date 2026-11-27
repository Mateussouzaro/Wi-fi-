const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('console', m => { if (m.type() === 'error') console.log('console', m.text()); });
  await p.goto('http://localhost:8777/render.html');
  await p.waitForFunction('window.ready===true', null, { timeout: 120000 });
  const shots = {
    fachada: [[-215, 18, -160], [-220, 8, -70], 55],
    salao: [[-222, 9, -80], [-220, 3, -25], 70],
    topo: [[-220, 260, -30], [-220, 0, -30.1], 50],
    estudio: [[-245, 8, 22], [-220, 2, 40], 65],
  };
  for (const [n, [pos, look, fov]] of Object.entries(shots)) {
    await p.evaluate(([a, c, f]) => window.shot(a, c, f), [pos, look, fov]);
    await p.screenshot({ path: `dealer_${n}.png` });
  }
  await b.close();
})();
