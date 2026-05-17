import * as THREE from 'three';
import type { EnemySnapshot, GameSnapshot } from '../../sim/types';
import { ENEMY_COLUMNS, ENEMY_ROWS } from '../../sim/world';

const SLOT_START_Z = -6;
const SLOT_ROW_STEP_Z = 5;
const SLOT_STEP_X = 1.55;

interface EnemyMesh {
  body: THREE.Mesh;
  hpRing: THREE.Mesh;
  label: THREE.Sprite;
  bodyMaterial: THREE.MeshStandardMaterial;
  hpMaterial: THREE.MeshBasicMaterial;
  labelMaterial: THREE.SpriteMaterial;
  currentX: number;
  currentZ: number;
  targetX: number;
  targetZ: number;
  spawnStartedAt: number;
  deathStartedAt: number | null;
  deathBaseScale: THREE.Vector3 | null;
  deathBaseY: number;
  hitStartedAt: number | null;
  attackStartedAt: number | null;
  lastHp: number;
  labelKey: string;
}

function slotColumn(slot: number): number {
  return slot % ENEMY_COLUMNS;
}

function slotRow(slot: number): number {
  return Math.floor(slot / ENEMY_COLUMNS);
}

function slotX(slot: number): number {
  return (slotColumn(slot) - Math.floor(ENEMY_COLUMNS / 2)) * SLOT_STEP_X;
}

function slotZ(slot: number): number {
  return SLOT_START_Z - slotRow(slot) * SLOT_ROW_STEP_Z;
}

function enemyTypeColor(definitionId: string): number {
  if (definitionId === 'redline_brute') {
    return 0xff4f9b;
  }

  if (definitionId === 'pulse_collector') {
    return 0x62efff;
  }

  return 0xff334f;
}

function enemyTypeLabel(definitionId: string): string {
  if (definitionId === 'redline_brute') {
    return 'BRU';
  }

  if (definitionId === 'pulse_collector') {
    return 'COL';
  }

  return 'WSP';
}

function enemyMaterial(definitionId: string): THREE.MeshStandardMaterial {
  if (definitionId === 'redline_brute') {
    return new THREE.MeshStandardMaterial({
      color: 0x7d1b4c,
      emissive: 0x280516,
      transparent: true,
      roughness: 0.5,
      metalness: 0.18
    });
  }

  if (definitionId === 'pulse_collector') {
    return new THREE.MeshStandardMaterial({
      color: 0x2f7f86,
      emissive: 0x0b3139,
      transparent: true,
      roughness: 0.36,
      metalness: 0.12
    });
  }

  return new THREE.MeshStandardMaterial({
    color: 0xaa1634,
    emissive: 0x4b0818,
    transparent: true,
    roughness: 0.42,
    metalness: 0.1
  });
}

function enemyGeometry(definitionId: string): THREE.BufferGeometry {
  if (definitionId === 'redline_brute') {
    return new THREE.DodecahedronGeometry(0.72, 0);
  }

  if (definitionId === 'pulse_collector') {
    return new THREE.OctahedronGeometry(0.68, 1);
  }

  return new THREE.IcosahedronGeometry(0.58, 1);
}

function enemyTypeScale(definitionId: string): THREE.Vector3 {
  if (definitionId === 'redline_brute') {
    return new THREE.Vector3(1.18, 1.18, 1.18);
  }

  if (definitionId === 'pulse_collector') {
    return new THREE.Vector3(0.9, 1.28, 0.9);
  }

  return new THREE.Vector3(0.82, 0.82, 0.82);
}

function labelTexture(enemy: EnemySnapshot): { key: string; texture: THREE.CanvasTexture } {
  const key = `${enemy.definitionId}:${enemy.name}:${enemy.hp}/${enemy.maxHp}`;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  if (!context) {
    return { key, texture: new THREE.CanvasTexture(canvas) };
  }

  const color = `#${enemyTypeColor(enemy.definitionId).toString(16).padStart(6, '0')}`;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(12, 12, 16, 0.74)';
  context.strokeStyle = color;
  context.lineWidth = 4;
  context.beginPath();
  context.roundRect(8, 8, 240, 78, 14);
  context.fill();
  context.stroke();

  context.fillStyle = color;
  context.font = '700 22px Inter, system-ui, sans-serif';
  context.fillText(enemyTypeLabel(enemy.definitionId), 22, 36);

  context.fillStyle = '#fff7f8';
  context.font = '700 20px Inter, system-ui, sans-serif';
  context.fillText(enemy.name, 78, 36);

  context.fillStyle = 'rgba(255, 255, 255, 0.78)';
  context.font = '700 18px Inter, system-ui, sans-serif';
  context.fillText(`${enemy.hp}/${enemy.maxHp}`, 22, 68);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return { key, texture };
}

export class CorridorRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  private readonly enemies = new Map<string, EnemyMesh>();
  private readonly seenAttackEvents = new Set<string>();
  private readonly burstLight = new THREE.PointLight(0xffd6d6, 0, 16);
  private readonly clock = new THREE.Clock();

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.background = new THREE.Color(0x100f14);
    this.camera.position.set(0, 2.4, 5.4);
    this.camera.lookAt(0, 1.15, -13);

    this.buildCorridor();
    this.scene.add(new THREE.HemisphereLight(0xbad7ff, 0x25080d, 1.6));
    const keyLight = new THREE.DirectionalLight(0xffd1c6, 1.8);
    keyLight.position.set(3, 5, 2);
    this.scene.add(keyLight);
    this.burstLight.position.set(0, 2.2, -7);
    this.scene.add(this.burstLight);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  render(snapshot: GameSnapshot): void {
    const elapsed = this.clock.getElapsedTime();
    const burstAge = snapshot.lastBurstTick === null ? 999 : snapshot.tick - snapshot.lastBurstTick;
    this.burstLight.intensity = Math.max(0, 7 - burstAge * 0.7);

    for (const enemy of snapshot.enemies) {
      this.syncEnemy(enemy, elapsed);
    }

    for (const event of snapshot.debug.events) {
      if (event.type !== 'EnemyAttacked') {
        continue;
      }

      const key = `${event.traceId}:${event.tick}:${event.enemyId}`;
      if (this.seenAttackEvents.has(key)) {
        continue;
      }

      this.seenAttackEvents.add(key);
      const mesh = this.enemies.get(event.enemyId);
      if (mesh) {
        mesh.attackStartedAt = elapsed;
      }
    }

    for (const [id, mesh] of this.enemies) {
      const stillExists = snapshot.enemies.some((enemy) => enemy.id === id && enemy.alive);
      if (!stillExists) {
        this.animateDeath(mesh, elapsed);
      }
    }

    this.camera.position.x = Math.sin(elapsed * 0.8) * 0.06;
    this.renderer.render(this.scene, this.camera);
  }

  private animateDeath(mesh: EnemyMesh, elapsed: number): void {
    if (mesh.deathStartedAt === null) {
      mesh.deathStartedAt = elapsed;
      mesh.deathBaseScale = mesh.body.scale.clone();
      mesh.deathBaseY = mesh.body.position.y;
    }

    const age = elapsed - mesh.deathStartedAt;
    const alpha = Math.max(0, 1 - age / 0.5);
    const burstScale = 1 + age * 1.8;
    mesh.body.visible = alpha > 0;
    mesh.hpRing.visible = alpha > 0;
    mesh.label.visible = alpha > 0;
    mesh.bodyMaterial.opacity = alpha;
    mesh.hpMaterial.opacity = alpha;
    mesh.labelMaterial.opacity = alpha;
    if (mesh.deathBaseScale) {
      mesh.body.scale.copy(mesh.deathBaseScale).multiplyScalar(burstScale);
    }
    mesh.body.position.y = mesh.deathBaseY + age * 0.65;
  }

  private resize(): void {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private buildCorridor(): void {
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x17141a, roughness: 0.78, metalness: 0.05 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 52), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -18;
    this.scene.add(floor);

    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x24161d,
      roughness: 0.85,
      metalness: 0.02
    });

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.2, 52), wallMaterial);
    leftWall.position.set(-4.6, 1.5, -18);
    this.scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.2, 52), wallMaterial);
    rightWall.position.set(4.6, 1.5, -18);
    this.scene.add(rightWall);

    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xd73753, transparent: true, opacity: 0.34 });
    for (let z = -4; z >= -42; z -= 4) {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-4.2, 0.03, z),
        new THREE.Vector3(4.2, 0.03, z)
      ]);
      this.scene.add(new THREE.Line(geometry, lineMaterial));
    }

    const slotMaterial = new THREE.MeshBasicMaterial({
      color: 0x73ffe2,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide
    });
    const frontSlotMaterial = new THREE.MeshBasicMaterial({
      color: 0x73ffe2,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide
    });
    for (let slot = 0; slot < ENEMY_COLUMNS * ENEMY_ROWS; slot += 1) {
      const marker = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.12, 40), slot < ENEMY_COLUMNS ? frontSlotMaterial : slotMaterial);
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(slotX(slot), 0.08, slotZ(slot));
      this.scene.add(marker);
    }

    const laneMaterial = new THREE.LineBasicMaterial({ color: 0x73ffe2, transparent: true, opacity: 0.22 });
    for (let column = 0; column < ENEMY_COLUMNS; column += 1) {
      const x = (column - Math.floor(ENEMY_COLUMNS / 2)) * SLOT_STEP_X;
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 0.07, -3.4),
        new THREE.Vector3(x, 0.07, -21.2)
      ]);
      this.scene.add(new THREE.Line(geometry, laneMaterial));
    }

    const railGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-1.6, 0.05, 2),
      new THREE.Vector3(-1.6, 0.05, -43),
      new THREE.Vector3(1.6, 0.05, -43),
      new THREE.Vector3(1.6, 0.05, 2)
    ]);
    this.scene.add(new THREE.Line(railGeometry, new THREE.LineBasicMaterial({ color: 0x73ffe2, transparent: true, opacity: 0.26 })));
  }

  private syncEnemy(enemy: EnemySnapshot, elapsed: number): void {
    if (!enemy.alive) {
      return;
    }

    let mesh = this.enemies.get(enemy.id);
    if (!mesh) {
      const bodyMaterial = enemyMaterial(enemy.definitionId);
      const body = new THREE.Mesh(enemyGeometry(enemy.definitionId), bodyMaterial);
      const hpMaterial = new THREE.MeshBasicMaterial({ color: enemyTypeColor(enemy.definitionId), transparent: true });
      const hpRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.72, 0.025, 8, 32),
        hpMaterial
      );
      const label = labelTexture(enemy);
      const labelMaterial = new THREE.SpriteMaterial({
        map: label.texture,
        transparent: true,
        depthTest: false,
        depthWrite: false
      });
      const labelSprite = new THREE.Sprite(labelMaterial);
      this.scene.add(body);
      this.scene.add(hpRing);
      this.scene.add(labelSprite);
      const targetX = slotX(enemy.slot);
      const targetZ = slotZ(enemy.slot);
      mesh = {
        body,
        hpRing,
        label: labelSprite,
        bodyMaterial,
        hpMaterial,
        labelMaterial,
        currentX: targetX,
        currentZ: targetZ - 1.8,
        targetX,
        targetZ,
        spawnStartedAt: elapsed,
        deathStartedAt: null,
        deathBaseScale: null,
        deathBaseY: 1,
        hitStartedAt: null,
        attackStartedAt: null,
        lastHp: enemy.hp,
        labelKey: label.key
      };
      this.enemies.set(enemy.id, mesh);
    }

    if (enemy.hp < mesh.lastHp) {
      mesh.hitStartedAt = elapsed;
    }
    mesh.lastHp = enemy.hp;

    const labelKey = `${enemy.definitionId}:${enemy.name}:${enemy.hp}/${enemy.maxHp}`;
    if (labelKey !== mesh.labelKey) {
      mesh.labelMaterial.map?.dispose();
      const label = labelTexture(enemy);
      mesh.labelMaterial.map = label.texture;
      mesh.labelMaterial.needsUpdate = true;
      mesh.labelKey = label.key;
    }

    const x = slotX(enemy.slot);
    const z = slotZ(enemy.slot);
    mesh.targetX = x;
    mesh.targetZ = z;
    mesh.currentX += (mesh.targetX - mesh.currentX) * 0.18;
    mesh.currentZ += (mesh.targetZ - mesh.currentZ) * 0.18;

    const spawnAlpha = Math.min(1, (elapsed - mesh.spawnStartedAt) / 0.34);
    const hitAge = mesh.hitStartedAt === null ? 99 : elapsed - mesh.hitStartedAt;
    const hitPulse = Math.max(0, 1 - hitAge / 0.28);
    const attackAge = mesh.attackStartedAt === null ? 99 : elapsed - mesh.attackStartedAt;
    const attackPulse = attackAge < 0.5 ? Math.sin((1 - attackAge / 0.5) * Math.PI) : 0;
    const baseScale = enemyTypeScale(enemy.definitionId);
    const healthPressure = (1 - enemy.hp / enemy.maxHp) * 0.25;
    const pulseScale = 1 + hitPulse * 0.18 + attackPulse * 0.16 + (1 - spawnAlpha) * 0.32;

    mesh.deathStartedAt = null;
    mesh.deathBaseScale = null;
    mesh.body.visible = true;
    mesh.hpRing.visible = true;
    mesh.label.visible = enemy.slot < ENEMY_COLUMNS;
    mesh.bodyMaterial.opacity = spawnAlpha;
    mesh.hpMaterial.opacity = spawnAlpha;
    mesh.labelMaterial.opacity = spawnAlpha;
    mesh.bodyMaterial.emissiveIntensity = 1 + hitPulse * 2.8 + attackPulse * 4;
    mesh.body.position.set(mesh.currentX, 1 + Math.sin(elapsed * 4 + enemy.z) * 0.08 + attackPulse * 0.12, mesh.currentZ + attackPulse * 1.1);
    mesh.deathBaseY = mesh.body.position.y;
    mesh.body.rotation.y += 0.012;
    mesh.body.scale.set(baseScale.x * (pulseScale + healthPressure), baseScale.y * (pulseScale + healthPressure), baseScale.z * (pulseScale + healthPressure));
    mesh.hpRing.position.set(mesh.currentX, 1.9, mesh.currentZ);
    mesh.hpRing.rotation.x = Math.PI / 2;
    mesh.hpRing.scale.set(enemy.hp / enemy.maxHp, enemy.hp / enemy.maxHp, 1);
    mesh.label.position.set(mesh.currentX, 2.55, mesh.currentZ);
    mesh.label.scale.set(1.45, 0.56, 1);
  }
}
