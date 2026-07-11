export async function createGlassBg(container) {
  const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03010A);

  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.z = 6;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);

  const envScene = new THREE.Scene();
  const envGradient = new THREE.Mesh(
    new THREE.SphereGeometry(50, 32, 32),
    new THREE.MeshBasicMaterial({
      side: THREE.BackSide,
      onBeforeCompile: (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <common>',
          `#include <common>
          varying vec3 vWorldPos;`
        ).replace(
          '#include <output_fragment>',
          `#include <output_fragment>
          vec3 dir = normalize(vWorldPos);
          float t = dir.y * 0.5 + 0.5;
          vec3 col1 = vec3(0.31, 0.27, 1.0);
          vec3 col2 = vec3(0.02, 0.01, 0.04);
          gl_FragColor = vec4(mix(col2, col1, pow(t, 0.6)), 1.0);`
        );
        const vs = shader.vertexShader;
        shader.vertexShader = vs.replace(
          '#include <common>',
          `#include <common>
          varying vec3 vWorldPos;
          void main() { vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz; }`
        );
      }
    })
  );
  envScene.add(envGradient);
  envScene.updateMatrixWorld(true);
  const envRT = pmremGenerator.fromScene(envScene, 0, 0.1, 100);
  pmremGenerator.dispose();

  const torusGeo = new THREE.TorusKnotGeometry(0.8, 0.3, 128, 32);
  const glassMat = new THREE.MeshPhysicalMaterial({
    metalness: 0.0,
    roughness: 0.05,
    transmission: 0.95,
    thickness: 2.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    envMap: envRT.texture,
    envMapIntensity: 2.0,
    ior: 1.5,
    transparent: true,
    opacity: 0.9,
    color: new THREE.Color(0x8888ff),
    emissive: new THREE.Color(0x4444ff),
    emissiveIntensity: 0.15,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(torusGeo, glassMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const ringGeo = new THREE.TorusKnotGeometry(1.1, 0.05, 64, 16);
  const ringMat = new THREE.MeshPhysicalMaterial({
    metalness: 0.8,
    roughness: 0.2,
    envMap: envRT.texture,
    envMapIntensity: 1.5,
    emissive: new THREE.Color(0x6666ff),
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.4,
    color: new THREE.Color(0x4444ff),
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  scene.add(ring);

  const particles = new THREE.BufferGeometry();
  const pCount = 800;
  const pos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount * 3; i++) pos[i] = (Math.random() - 0.5) * 20;
  particles.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({
    size: 0.02,
    color: new THREE.Color(0x6666ff),
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const particleSystem = new THREE.Points(particles, pMat);
  scene.add(particleSystem);

  const mouse = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };

  container.addEventListener('pointermove', (e) => {
    const rect = container.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  });

  let running = true;

  function animate(t) {
    if (!running) return;
    requestAnimationFrame(animate);

    target.x += (mouse.x - target.x) * 0.05;
    target.y += (mouse.y - target.y) * 0.05;

    mesh.position.x = target.x * 1.5;
    mesh.position.y = target.y * 1.5;
    mesh.rotation.x = t * 0.0003 + target.y * 0.3;
    mesh.rotation.y = t * 0.0005 + target.x * 0.3;

    ring.position.x = target.x * 1.2;
    ring.position.y = target.y * 1.2;
    ring.rotation.x = t * 0.0002 - target.y * 0.2;
    ring.rotation.y = t * 0.0004 + target.x * 0.2;
    ring.scale.setScalar(1 + Math.sin(t * 0.001) * 0.05);

    particleSystem.rotation.y = t * 0.0001;

    camera.position.x = target.x * 0.3;
    camera.position.y = target.y * 0.3;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  animate(0);

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };

  window.addEventListener('resize', resize);

  return () => {
    running = false;
    window.removeEventListener('resize', resize);
    if (renderer.domElement.parentElement === container) container.removeChild(renderer.domElement);
    renderer.dispose();
    torusGeo.dispose();
    glassMat.dispose();
    ringGeo.dispose();
    ringMat.dispose();
    particles.dispose();
    pMat.dispose();
    envRT.texture.dispose();
  };
}
