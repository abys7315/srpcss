import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RotateCcw, Eye, Compass, ChevronUp, ChevronDown } from 'lucide-react';

interface Wellbore3DViewerProps {
  depthM?: number;
  pumpDepthM?: number;
  temperatureC?: number;
  viscosityCp?: number;
  apiGravity?: number;
  wellheadPressureBar?: number;
  intakePressureBar?: number;
  tubingPressureBar?: number;
  steamChamberTempC?: number;
  wellName?: string;
  isPumping?: boolean;
  spm?: number;
  isFloating?: boolean;
}

export const Wellbore3DViewer: React.FC<Wellbore3DViewerProps> = ({
  depthM = 1020,
  pumpDepthM = 950,
  temperatureC = 57.3,
  viscosityCp = 2395,
  apiGravity: _apiGravity = 18.0,
  wellheadPressureBar = 5.0,
  intakePressureBar = 24.3,
  steamChamberTempC = 220,
  wellName = 'BGW-01',
  isPumping = true,
  spm = 4.2,
  isFloating = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const [cameraPreset, setCameraPreset] = useState<'full' | 'surface' | 'downhole' | 'thermal'>('full');
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [hudStats, setHudStats] = useState({
    prl: 14200,
    strokePhase: 0,
    isUpstroke: true,
    dynWHP: '5.00',
    dynPIP: '24.30',
    valveState: 'TV: CLOSED · SV: OPEN',
  });

  // Keep animated refs to avoid re-initializing Three.js on every prop change
  const propsRef = useRef({
    isPumping,
    spm,
    viscosityCp,
    temperatureC,
    steamChamberTempC,
    wellheadPressureBar,
    intakePressureBar,
    isFloating,
  });

  useEffect(() => {
    propsRef.current = {
      isPumping,
      spm,
      viscosityCp,
      temperatureC,
      steamChamberTempC,
      wellheadPressureBar,
      intakePressureBar,
      isFloating,
    };
  }, [isPumping, spm, viscosityCp, temperatureC, steamChamberTempC, wellheadPressureBar, intakePressureBar, isFloating]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 560;

    // 1. Scene & Background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0f17);
    scene.fog = new THREE.FogExp2(0x0c0f17, 0.015);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);
    camera.position.set(-18, -4, 38);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(-2, -12, 0);
    controls.maxDistance = 80;
    controls.minDistance = 3;
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff5e6, 1.4);
    dirLight.position.set(20, 30, 20);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const blueRimLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
    blueRimLight.position.set(-20, -10, -15);
    scene.add(blueRimLight);

    // Bottomhole thermal point light
    const steamLight = new THREE.PointLight(0xf97316, 2.5, 25);
    steamLight.position.set(-3.2, -30, 0);
    scene.add(steamLight);

    // 6. Surface Ground Plane & Strata Blocks
    // Ground surface at y = 10
    const groundGeo = new THREE.PlaneGeometry(60, 60, 20, 20);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      roughness: 0.9,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 10;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid helper on surface
    const grid = new THREE.GridHelper(50, 25, 0xf59e0b, 0x44403c);
    grid.position.y = 10.02;
    scene.add(grid);

    // Translucent Cutaway Geological Strata
    const strataLayers = [
      { name: 'Overburden', top: 10, bottom: 0, color: 0x57534e, opacity: 0.15 },
      { name: 'Sandstone', top: 0, bottom: -12, color: 0x78350f, opacity: 0.18 },
      { name: 'Caprock Shale', top: -12, bottom: -24, color: 0x292524, opacity: 0.22 },
      { name: 'Jodhpur Reservoir', top: -24, bottom: -36, color: 0x1c1917, opacity: 0.28 },
    ];

    strataLayers.forEach((layer) => {
      const height = layer.top - layer.bottom;
      const geo = new THREE.BoxGeometry(26, height, 18);
      const mat = new THREE.MeshStandardMaterial({
        color: layer.color,
        transparent: true,
        opacity: layer.opacity,
        roughness: 0.9,
      });
      const box = new THREE.Mesh(geo, mat);
      box.position.set(0, layer.bottom + height / 2, 0);
      scene.add(box);

      // Edge wireframe for strata boundaries
      const edges = new THREE.EdgesGeometry(geo);
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.3 })
      );
      line.position.copy(box.position);
      scene.add(line);
    });

    // 7. Surface SRP Pumpjack Model
    const pumpjackGroup = new THREE.Group();
    pumpjackGroup.position.set(0, 10, 0);
    scene.add(pumpjackGroup);

    // Samson Post (A-Frame)
    const postMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.4 });
    const postLeg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 4), postMat);
    postLeg1.position.set(0.6, 2, 0.6);
    postLeg1.rotation.z = -0.15;
    postLeg1.rotation.x = 0.15;
    pumpjackGroup.add(postLeg1);

    const postLeg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 4), postMat);
    postLeg2.position.set(-0.6, 2, 0.6);
    postLeg2.rotation.z = 0.15;
    postLeg2.rotation.x = 0.15;
    pumpjackGroup.add(postLeg2);

    const postLeg3 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 4), postMat);
    postLeg3.position.set(0, 2, -0.7);
    postLeg3.rotation.x = -0.18;
    pumpjackGroup.add(postLeg3);

    // Walking Beam Pivot at (0, 4, 0)
    const pivotBearing = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.6), postMat);
    pivotBearing.rotation.z = Math.PI / 2;
    pivotBearing.position.set(0, 4, 0);
    pumpjackGroup.add(pivotBearing);

    // Walking Beam Group (pivots around Z-axis at (0, 4, 0))
    const walkingBeamPivot = new THREE.Group();
    walkingBeamPivot.position.set(0, 4, 0);
    pumpjackGroup.add(walkingBeamPivot);

    const beamMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 });
    const beamMesh = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.45, 0.4), beamMat);
    beamMesh.position.set(-0.5, 0, 0);
    walkingBeamPivot.add(beamMesh);

    // Horsehead (Mounted at front end of walking beam: x = -4.2)
    const horseheadGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.4, 16, 1, false, Math.PI * 0.7, Math.PI * 0.6);
    const horseheadMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2 });
    const horsehead = new THREE.Mesh(horseheadGeo, horseheadMat);
    horsehead.rotation.z = Math.PI / 2;
    horsehead.position.set(-4.0, 0, 0);
    walkingBeamPivot.add(horsehead);

    // Rear Equalizer / Pitman attachment
    const rearBracket = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.5), postMat);
    rearBracket.position.set(3.0, 0, 0);
    walkingBeamPivot.add(rearBracket);

    // Rotating Crank Shaft & Counterweights at rear base (x = 2.4, y = 1.2, z = 0)
    const crankPivot = new THREE.Group();
    crankPivot.position.set(2.4, 1.5, 0);
    pumpjackGroup.add(crankPivot);

    const crankArmMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });
    const crankArm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.8, 0.3), crankArmMat);
    crankArm.position.set(0, 0.6, 0.3);
    crankPivot.add(crankArm);

    // Counterweight heavy slab
    const counterweightMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6, roughness: 0.4 });
    const counterweight = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.5), counterweightMat);
    counterweight.position.set(0, 1.0, 0.3);
    crankPivot.add(counterweight);

    // Pitman Arm connecting Crank Pin to Rear of Walking Beam
    const pitmanGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.2);
    const pitmanMesh = new THREE.Mesh(pitmanGeo, crankArmMat);
    pumpjackGroup.add(pitmanMesh);

    // Polished Rod Bridle from Horsehead to Wellhead
    // Wellhead is located at x = -3.2, z = 0
    const wellheadPos = new THREE.Vector3(-3.2, 10, 0);

    // Stuffing box at wellhead
    const stuffingBox = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.45, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 })
    );
    stuffingBox.position.copy(wellheadPos);
    stuffingBox.position.y += 0.4;
    scene.add(stuffingBox);

    // 8. Wellbore Column & Casings (Centered at x = -3.2, z = 0)
    const wellboreGroup = new THREE.Group();
    wellboreGroup.position.set(-3.2, 0, 0);
    scene.add(wellboreGroup);

    // Telescoping Casings:
    // Conductor Casing: y: 10 to 0 (length 10, radius 0.85)
    const conductorMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.4 });
    const conductorMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 10, 24, 1, true), conductorMat);
    conductorMesh.position.y = 5;
    wellboreGroup.add(conductorMesh);

    // Intermediate Casing: y: 0 to -12 (length 12, radius 0.7)
    const interMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.4 });
    const interMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 12, 24, 1, true), interMat);
    interMesh.position.y = -6;
    wellboreGroup.add(interMesh);

    // Production Casing: y: -12 to -34 (length 22, radius 0.55)
    const prodMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.4 });
    const prodMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 22, 24, 1, true), prodMat);
    prodMesh.position.y = -23;
    wellboreGroup.add(prodMesh);

    // Transparent Production Tubing (Inside Casing): y: 10 to -28 (length 38, radius 0.32)
    const tubingMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.38,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.8,
      thickness: 0.5,
    });
    const tubingMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 38, 24), tubingMat);
    tubingMesh.position.y = -9;
    wellboreGroup.add(tubingMesh);

    // Reciprocating Sucker Rod String: radius 0.07, chrome steel, length 38
    const rodMat = new THREE.MeshStandardMaterial({
      color: isFloating ? 0xef4444 : 0xf8fafc,
      metalness: 0.9,
      roughness: 0.15,
    });
    const rodMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 37.5, 12), rodMat);
    rodMesh.position.y = -8.75;
    wellboreGroup.add(rodMesh);

    // Subsurface SRP Pump Plunger (at Intake Depth: y = -26)
    const plungerMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.2 });
    const plungerMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.8, 16), plungerMat);
    plungerMesh.position.y = -26;
    wellboreGroup.add(plungerMesh);

    // Standing Valve assembly at bottom of pump barrel (fixed at y = -27.2)
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.7, roughness: 0.3 });
    const barrelMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.8, 16), barrelMat);
    barrelMesh.position.y = -27.2;
    wellboreGroup.add(barrelMesh);

    // 9. Rising Multiphase Fluid Particles inside the Tubing
    const particleCount = 45;
    const particleGeo = new THREE.SphereGeometry(0.09, 8, 8);
    const particleMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.3,
      roughness: 0.5,
      emissive: 0x78350f,
      emissiveIntensity: 0.6,
    });

    const particles: THREE.Mesh[] = [];
    for (let i = 0; i < particleCount; i++) {
      const p = new THREE.Mesh(particleGeo, particleMat);
      p.position.set(
        (Math.random() - 0.5) * 0.18,
        -27 + (i / particleCount) * 37,
        (Math.random() - 0.5) * 0.18
      );
      wellboreGroup.add(p);
      particles.push(p);
    }

    // 10. Volumetric 3D Thermal Steam Chamber in Reservoir (y = -30)
    const steamChamberGroup = new THREE.Group();
    steamChamberGroup.position.set(0, -30, 0);
    wellboreGroup.add(steamChamberGroup);

    const steamMat = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      emissive: 0xf97316,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.55,
      roughness: 0.7,
    });
    const steamSphere = new THREE.Mesh(new THREE.SphereGeometry(3.5, 24, 24), steamMat);
    steamSphere.scale.set(1.4, 0.85, 1.4);
    steamChamberGroup.add(steamSphere);

    // Outer thermal pulsation wave rings
    const ringGeo = new THREE.RingGeometry(3.6, 3.8, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfb923c,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const ring1 = new THREE.Mesh(ringGeo, ringMat);
    ring1.rotation.x = Math.PI / 2;
    steamChamberGroup.add(ring1);

    const ring2 = new THREE.Mesh(ringGeo, ringMat);
    ring2.rotation.x = Math.PI / 2;
    ring2.scale.set(1.25, 1.25, 1.25);
    steamChamberGroup.add(ring2);

    // 11. Perforation Inflow Jets (Streams entering wellbore horizontally at y = -30)
    const inflowJets: THREE.Mesh[] = [];
    const jetGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.8);
    jetGeo.rotateZ(Math.PI / 2);
    const jetMat = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.85 });

    for (let j = 0; j < 8; j++) {
      const angle = (j / 8) * Math.PI * 2;
      const jet = new THREE.Mesh(jetGeo, jetMat);
      jet.position.set(Math.cos(angle) * 1.6, -30 + ((j % 3) - 1) * 0.6, Math.sin(angle) * 1.6);
      jet.rotation.y = -angle;
      wellboreGroup.add(jet);
      inflowJets.push(jet);
    }

    // 12. Animation Loop (60 FPS requestAnimationFrame)
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const time = clock.getElapsedTime();
      const currentProps = propsRef.current;

      // Kinematics calculations
      const currentSpm = currentProps.isPumping ? Math.max(currentProps.spm, 0.5) : 0;
      const cycleFrequency = (currentSpm / 60) * 2 * Math.PI; // rad/sec
      const strokePhase = (time * (currentSpm / 60)) % 1;
      const isUpstroke = strokePhase < 0.5;

      // Harmonic motion
      const tiltAngle = Math.sin(time * cycleFrequency) * 0.16; // ~9 degrees tilt
      const rodOscillation = Math.sin(time * cycleFrequency) * 1.1; // vertical stroke offset

      // 1. Rock walking beam
      walkingBeamPivot.rotation.z = tiltAngle;

      // 2. Rotate crank 360 deg
      crankPivot.rotation.z = -time * cycleFrequency;

      // 3. Update Pitman arm position
      const rearPoint = new THREE.Vector3(3.0, 0, 0).applyMatrix4(walkingBeamPivot.matrixWorld);
      const crankPinPoint = new THREE.Vector3(0, 0.6, 0.3).applyMatrix4(crankPivot.matrixWorld);
      pitmanMesh.position.copy(rearPoint).lerp(crankPinPoint, 0.5);
      pitmanMesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        crankPinPoint.clone().sub(rearPoint).normalize()
      );
      pitmanMesh.scale.set(1, rearPoint.distanceTo(crankPinPoint) / 3.2, 1);

      // 4. Oscillate Sucker Rod & Plunger
      rodMesh.position.y = -8.75 + rodOscillation;
      plungerMesh.position.y = -26 + rodOscillation;

      // 5. Animate Rising Fluid Droplets
      if (currentProps.isPumping) {
        const fluidSpeed = isUpstroke ? delta * 7.5 : delta * 1.5;
        particles.forEach((p) => {
          p.position.y += fluidSpeed;
          if (p.position.y > 10) {
            p.position.y = -27 + Math.random() * 1.5;
          }
        });
      }

      // 6. Thermal Steam Chamber Respiration
      const tempScale = Math.min(1.4, Math.max(0.6, currentProps.steamChamberTempC / 200));
      const respiration = 1.0 + Math.sin(time * 3) * 0.05;
      steamSphere.scale.set(1.4 * tempScale * respiration, 0.85 * tempScale * respiration, 1.4 * tempScale * respiration);
      ring1.scale.set(tempScale * respiration, tempScale * respiration, tempScale * respiration);
      ring2.scale.set(1.25 * tempScale * respiration, 1.25 * tempScale * respiration, 1.25 * tempScale * respiration);

      // Inflow jet pulsation
      inflowJets.forEach((jet, idx) => {
        jet.scale.x = 0.8 + Math.sin(time * 8 + idx) * 0.3;
      });

      // 7. Update HUD Telemetry
      const dynWHP = (
        currentProps.wellheadPressureBar +
        (isUpstroke ? Math.sin(strokePhase * 2 * Math.PI) * 0.32 : -0.08)
      ).toFixed(2);

      const dynPIP = (
        currentProps.intakePressureBar -
        (isUpstroke ? Math.sin(strokePhase * 2 * Math.PI) * 0.42 : -0.12)
      ).toFixed(2);

      const baseRodWt = 9450;
      const fluidWt = 4400;
      const viscousDrag = (currentProps.viscosityCp / 1000) * 360;
      const prl = Math.round(
        isUpstroke
          ? baseRodWt + fluidWt * Math.sin(strokePhase * Math.PI) + viscousDrag
          : baseRodWt - 2400 - viscousDrag * 0.7 - (currentProps.isFloating ? 1800 : 0)
      );

      setHudStats({
        prl,
        strokePhase: Math.round(strokePhase * 100),
        isUpstroke,
        dynWHP,
        dynPIP,
        valveState: isUpstroke ? 'TV: CLOSED · SV: OPEN' : 'TV: OPEN · SV: CLOSED',
      });

      // Controls update
      controls.autoRotate = autoRotate;
      controls.update();

      renderer.render(scene, camera);
    };

    animate();

    // Handle Resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [autoRotate]); // Re-attach when autoRotate changes

  // Camera preset handler
  const setView = (mode: 'full' | 'surface' | 'downhole' | 'thermal') => {
    setCameraPreset(mode);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    if (mode === 'full') {
      camera.position.set(-18, -4, 38);
      controls.target.set(-2, -12, 0);
    } else if (mode === 'surface') {
      camera.position.set(-1, 15, 14);
      controls.target.set(0, 11, 0);
    } else if (mode === 'downhole') {
      camera.position.set(-3.2, -24, 10);
      controls.target.set(-3.2, -26, 0);
    } else if (mode === 'thermal') {
      camera.position.set(-3.2, -28, 12);
      controls.target.set(-3.2, -30, 0);
    }
  };

  return (
    <div className="relative w-full h-[620px] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 select-none shadow-2xl">
      {/* 3D WebGL Canvas Mount */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* 3D Navigation & Controls Overlay (Top-Left) */}
      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-lg border border-slate-700/60 shadow-lg text-xs">
        <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider px-1.5 flex items-center gap-1">
          <Compass className="w-3.5 h-3.5 text-sky-400 animate-spin" style={{ animationDuration: '8s' }} /> 3D Orbit
        </span>
        <button
          onClick={() => setView('full')}
          className={`px-2 py-1 rounded font-medium transition-all ${
            cameraPreset === 'full' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          Full Wellbore
        </button>
        <button
          onClick={() => setView('surface')}
          className={`px-2 py-1 rounded font-medium transition-all ${
            cameraPreset === 'surface' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          Surface SRP
        </button>
        <button
          onClick={() => setView('downhole')}
          className={`px-2 py-1 rounded font-medium transition-all ${
            cameraPreset === 'downhole' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          Pump Assembly
        </button>
        <button
          onClick={() => setView('thermal')}
          className={`px-2 py-1 rounded font-medium transition-all ${
            cameraPreset === 'thermal' ? 'bg-orange-600 text-white shadow-xs' : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          Steam Front
        </button>
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          title="Toggle Auto-Rotation"
          className={`px-2 py-1 rounded border transition-colors ${
            autoRotate
              ? 'bg-emerald-950 text-emerald-300 border-emerald-500'
              : 'text-slate-400 border-slate-700 hover:bg-slate-800'
          }`}
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>

      {/* Real-time Dynamic Telemetry HUD (Top-Right) */}
      <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur-md border border-slate-700/70 text-white p-3 rounded-xl shadow-xl text-xs space-y-2 min-w-[210px]">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-bold text-[11px] text-white tracking-tight">{wellName} 3D TWIN</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
            60 FPS WebGL
          </span>
        </div>

        {/* Stroke Phase */}
        <div className="flex justify-between items-center">
          <span className="text-slate-400 text-[11px]">Stroke Motion:</span>
          <span className="font-mono font-bold flex items-center gap-1 text-xs">
            {hudStats.isUpstroke ? (
              <span className="text-emerald-400 flex items-center">
                <ChevronUp className="w-3.5 h-3.5" /> UP ({hudStats.strokePhase}%)
              </span>
            ) : (
              <span className="text-sky-400 flex items-center">
                <ChevronDown className="w-3.5 h-3.5" /> DOWN ({hudStats.strokePhase}%)
              </span>
            )}
          </span>
        </div>

        {/* Polished Rod Load */}
        <div className="flex justify-between items-center">
          <span className="text-slate-400 text-[11px]">Polished Rod Load:</span>
          <span className="font-mono font-bold text-amber-300 text-xs">{hudStats.prl.toLocaleString()} lbs</span>
        </div>

        {/* Dynamic WHP / PIP */}
        <div className="flex justify-between items-center">
          <span className="text-slate-400 text-[11px]">WHP / PIP:</span>
          <span className="font-mono text-xs">
            <strong className="text-sky-300">{hudStats.dynWHP}</strong> /{' '}
            <strong className="text-amber-300">{hudStats.dynPIP} bar</strong>
          </span>
        </div>

        {/* Valve State */}
        <div className="text-[10px] font-mono text-slate-300 pt-1 border-t border-slate-800 text-center">
          {hudStats.valveState}
        </div>
      </div>

      {/* Subsurface Geological Depth Scale Legend (Bottom-Left) */}
      <div className="absolute bottom-3 left-3 bg-slate-900/85 backdrop-blur-md border border-slate-800 text-slate-300 p-2.5 rounded-lg text-[10px] font-mono space-y-1">
        <div className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider mb-1 flex items-center gap-1">
          <Eye className="w-3 h-3 text-sky-400" /> Geological Strata Cutaway
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2 rounded bg-stone-600 opacity-60" />
          <span>Surface & Overburden: 0 m – 250 m</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2 rounded bg-amber-900 opacity-60" />
          <span>Intermediate Sandstone: 250 m – 500 m</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2 rounded bg-stone-800 opacity-80" />
          <span>Caprock Shale: 500 m – 750 m</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2 rounded bg-sky-500 opacity-80" />
          <span className="text-sky-300">Pump Intake Assembly: {pumpDepthM} m</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2 rounded bg-orange-700 opacity-90" />
          <span className="text-orange-300 font-bold">
            Jodhpur Reservoir (CSS Steam Front): {depthM} m
          </span>
        </div>
      </div>

      {/* Interaction Hint (Bottom-Right) */}
      <div className="absolute bottom-3 right-3 text-[10px] text-slate-400 bg-slate-900/70 backdrop-blur-xs px-2.5 py-1.5 rounded-md border border-slate-800/80 pointer-events-none">
        🖱️ <strong className="text-slate-300">Left Drag:</strong> Rotate Orbit ·{' '}
        <strong className="text-slate-300">Right Drag:</strong> Pan ·{' '}
        <strong className="text-slate-300">Scroll:</strong> Zoom
      </div>
    </div>
  );
};
