import {
  BBT_TEAM_INFO,
  getAgentByIdOrName,
  getMapByIdOrName,
  getRoleColor,
} from './valorant-data';
import type { TeamLineup, TeamPlayer } from '../types/hq';

export type ExportDimensionPreset = '1920x1080' | '1080x1350';

const imageCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src)!);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const imgRatio = img.width / img.height;
  const targetRatio = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;

  if (imgRatio > targetRatio) {
    sw = img.height * targetRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / targetRatio;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  initialSize: number,
  minSize: number,
  weight: string,
  family: string
): string {
  let size = initialSize;
  while (size >= minSize) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) {
      return ctx.font;
    }
    size -= 1;
  }
  return `${weight} ${minSize}px ${family}`;
}

export async function generateLineupPngDataUrl(
  lineup: TeamLineup,
  players: TeamPlayer[],
  preset: ExportDimensionPreset = '1920x1080'
): Promise<string> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore font loading timeout
    }
  }

  const isLandscape = preset === '1920x1080';
  const W = isLandscape ? 1920 : 1080;
  const H = isLandscape ? 1080 : 1350;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const mapAsset = getMapByIdOrName(lineup.mapId);
  const mapName = mapAsset?.name || lineup.mapId || 'Ascent';
  const mapSites = mapAsset?.sites || 'TACTICAL MAP';

  const logoImg = await loadImage(BBT_TEAM_INFO.logoUrl);
  const mapSplashImg = mapAsset?.splash ? await loadImage(mapAsset.splash) : null;

  // 1. Deep Black Base
  ctx.fillStyle = '#07080A';
  ctx.fillRect(0, 0, W, H);

  // 2. Subtle Map Splash Backdrop
  if (mapSplashImg) {
    ctx.save();
    ctx.globalAlpha = 0.26;
    drawCoverImage(ctx, mapSplashImg, 0, 0, W, H);
    ctx.restore();
  }

  // 3. Dark Tactical Vignette & Crimson Atmosphere
  const vignette = ctx.createLinearGradient(0, 0, 0, H);
  vignette.addColorStop(0, 'rgba(7, 8, 10, 0.90)');
  vignette.addColorStop(0.25, 'rgba(7, 8, 10, 0.68)');
  vignette.addColorStop(0.75, 'rgba(7, 8, 10, 0.86)');
  vignette.addColorStop(1, 'rgba(7, 8, 10, 0.98)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  const glowTopLeft = ctx.createRadialGradient(
    W * 0.14,
    H * 0.1,
    10,
    W * 0.14,
    H * 0.1,
    W * 0.55
  );
  glowTopLeft.addColorStop(0, 'rgba(158, 20, 27, 0.28)');
  glowTopLeft.addColorStop(1, 'rgba(158, 20, 27, 0)');
  ctx.fillStyle = glowTopLeft;
  ctx.fillRect(0, 0, W, H);

  const glowBottomRight = ctx.createRadialGradient(
    W * 0.86,
    H * 0.88,
    10,
    W * 0.86,
    H * 0.88,
    W * 0.5
  );
  glowBottomRight.addColorStop(0, 'rgba(158, 20, 27, 0.22)');
  glowBottomRight.addColorStop(1, 'rgba(158, 20, 27, 0)');
  ctx.fillStyle = glowBottomRight;
  ctx.fillRect(0, 0, W, H);

  // 4. Tactical Grid
  ctx.save();
  ctx.strokeStyle = 'rgba(200, 162, 115, 0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore();

  // Top Accent Bar
  const topBar = ctx.createLinearGradient(0, 0, W, 0);
  topBar.addColorStop(0, '#9E141B');
  topBar.addColorStop(0.5, '#C8A273');
  topBar.addColorStop(1, '#9E141B');
  ctx.fillStyle = topBar;
  ctx.fillRect(0, 0, W, 6);

  if (isLandscape) {
    await drawLandscape1080p(
      ctx,
      W,
      H,
      lineup,
      players,
      logoImg,
      mapSplashImg,
      mapName,
      mapSites
    );
  } else {
    await drawPortrait1350p(
      ctx,
      W,
      H,
      lineup,
      players,
      logoImg,
      mapSplashImg,
      mapName
    );
  }

  return canvas.toDataURL('image/png', 1.0);
}

async function drawLandscape1080p(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  lineup: TeamLineup,
  players: TeamPlayer[],
  logoImg: HTMLImageElement | null,
  mapSplashImg: HTMLImageElement | null,
  mapName: string,
  mapSites: string
) {
  const padX = 72;
  const headerY = 42;
  const totalW = W - padX * 2;

  // Header Panel
  ctx.save();
  drawRoundedRect(ctx, padX, headerY, totalW, 136, 20);
  ctx.fillStyle = 'rgba(15, 18, 24, 0.88)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(200, 162, 115, 0.28)';
  ctx.stroke();
  ctx.restore();

  // Left: BBT Original Logo + Team Name
  const logoSize = 98;
  const logoX = padX + 26;
  const logoY = headerY + 19;
  if (logoImg) {
    ctx.save();
    ctx.shadowColor = 'rgba(158, 20, 27, 0.6)';
    ctx.shadowBlur = 18;
    ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
    ctx.restore();
  }

  const brandX = logoX + logoSize + 22;
  ctx.fillStyle = '#9E141B';
  ctx.font = '700 13px Inter, sans-serif';
  ctx.fillText('PREMIER TEAM HQ  •  OFFICIAL ROSTER', brandX, headerY + 42);

  ctx.fillStyle = '#C8A273';
  ctx.font = '800 42px Rajdhani, Impact, sans-serif';
  ctx.fillText('BIGBLACKTEA', brandX, headerY + 84);

  const bbtW = ctx.measureText('BIGBLACKTEA').width;
  const badgeX = brandX + bbtW + 16;
  ctx.save();
  drawRoundedRect(ctx, badgeX, headerY + 52, 66, 34, 8);
  ctx.fillStyle = 'rgba(158, 20, 27, 0.3)';
  ctx.fill();
  ctx.strokeStyle = '#9E141B';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#ECE8E1';
  ctx.font = '700 19px Rajdhani, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BBT', badgeX + 33, headerY + 75);
  ctx.restore();

  ctx.fillStyle = '#878C8F';
  ctx.font = '500 15px Inter, sans-serif';
  ctx.fillText('STRATEGIE. TEAMWORK. ERFOLG.', brandX, headerY + 111);

  // Center: Lineup Title
  const centerX = W / 2 + 24;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#73FBD3';
  ctx.font = '700 12px JetBrains Mono, monospace';
  ctx.fillText('ACTIVE TACTICAL LINEUP', centerX, headerY + 44);

  const title = (lineup.name || `${mapName} Main`).toUpperCase();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = fitText(ctx, title, 500, 42, 24, '800', 'Rajdhani, sans-serif');
  ctx.fillText(title, centerX, headerY + 90);

  ctx.fillStyle = '#9E141B';
  ctx.fillRect(centerX - 60, headerY + 104, 120, 4);
  ctx.restore();

  // Right: Map Card inside Header
  const mapCardW = 340;
  const mapCardH = 104;
  const mapCardX = W - padX - mapCardW - 18;
  const mapCardY = headerY + 16;

  ctx.save();
  drawRoundedRect(ctx, mapCardX, mapCardY, mapCardW, mapCardH, 14);
  ctx.clip();
  if (mapSplashImg) {
    drawCoverImage(ctx, mapSplashImg, mapCardX, mapCardY, mapCardW, mapCardH);
  } else {
    ctx.fillStyle = '#181C24';
    ctx.fillRect(mapCardX, mapCardY, mapCardW, mapCardH);
  }
  const mapOverlay = ctx.createLinearGradient(
    mapCardX,
    mapCardY,
    mapCardX + mapCardW,
    mapCardY
  );
  mapOverlay.addColorStop(0, 'rgba(10, 12, 16, 0.94)');
  mapOverlay.addColorStop(0.65, 'rgba(10, 12, 16, 0.68)');
  mapOverlay.addColorStop(1, 'rgba(158, 20, 27, 0.35)');
  ctx.fillStyle = mapOverlay;
  ctx.fillRect(mapCardX, mapCardY, mapCardW, mapCardH);

  ctx.strokeStyle = 'rgba(200, 162, 115, 0.45)';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, mapCardX, mapCardY, mapCardW, mapCardH, 14);
  ctx.stroke();

  ctx.fillStyle = '#C8A273';
  ctx.font = '700 11px Inter, sans-serif';
  ctx.fillText('AUSGEWÄHLTE MAP', mapCardX + 20, mapCardY + 28);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 34px Rajdhani, sans-serif';
  ctx.fillText(mapName.toUpperCase(), mapCardX + 20, mapCardY + 66);

  ctx.fillStyle = '#878C8F';
  ctx.font = '600 12px JetBrains Mono, monospace';
  ctx.fillText(`VALORANT  •  ${mapSites}`, mapCardX + 20, mapCardY + 89);
  ctx.restore();

  // 5 Active Player Cards
  const cardsY = 210;
  const cardsH = 720;
  const gap = 24;
  const cardW = (totalW - gap * 4) / 5;

  for (let i = 0; i < 5; i++) {
    const slot = lineup.slots[i] || {
      slotIndex: i,
      playerId: null,
      agentId: null,
    };
    const cardX = padX + i * (cardW + gap);
    await drawPlayerAgentCard(
      ctx,
      cardX,
      cardsY,
      cardW,
      cardsH,
      slot.playerId,
      slot.agentId,
      i + 1,
      players,
      false
    );
  }

  // Footer with Substitute & Tactical Notes
  const footerY = 958;
  const footerH = 84;
  ctx.save();
  drawRoundedRect(ctx, padX, footerY, totalW, footerH, 16);
  ctx.fillStyle = 'rgba(14, 16, 22, 0.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#C8A273';
  ctx.font = '700 16px Rajdhani, sans-serif';
  ctx.fillText(
    'BIGBLACKTEA (BBT)  •  PREMIER STARTING FIVE',
    padX + 26,
    footerY + 34
  );

  const dateStr = new Date(lineup.updatedAt || Date.now()).toLocaleDateString(
    'de-DE',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }
  );
  const noteSnippet = lineup.notes?.trim()
    ? `  |  Notiz: ${lineup.notes.trim().slice(0, 70)}${
        lineup.notes.trim().length > 70 ? '…' : ''
      }`
    : '';
  ctx.fillStyle = '#878C8F';
  ctx.font = '500 14px Inter, sans-serif';
  ctx.fillText(
    `Stand: ${dateStr}  |  Map: ${mapName}${noteSnippet}`,
    padX + 26,
    footerY + 59
  );

  // Substitute Box on Right
  const subPlayer = lineup.substitute?.playerId
    ? players.find((p) => p.id === lineup.substitute?.playerId)
    : null;
  const subAgent = lineup.substitute?.agentId
    ? getAgentByIdOrName(lineup.substitute.agentId)
    : null;

  if (subPlayer || subAgent) {
    const subBoxW = 480;
    const subBoxX = W - padX - subBoxW - 14;
    const subBoxY = footerY + 12;
    const subBoxH = 60;

    drawRoundedRect(ctx, subBoxX, subBoxY, subBoxW, subBoxH, 12);
    ctx.fillStyle = 'rgba(158, 20, 27, 0.18)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(158, 20, 27, 0.48)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    let textStartX = subBoxX + 18;
    if (subAgent) {
      const subIcon = await loadImage(subAgent.displayIcon);
      if (subIcon) {
        ctx.save();
        drawRoundedRect(ctx, subBoxX + 12, subBoxY + 8, 44, 44, 8);
        ctx.clip();
        ctx.fillStyle = '#14171D';
        ctx.fillRect(subBoxX + 12, subBoxY + 8, 44, 44);
        ctx.drawImage(subIcon, subBoxX + 12, subBoxY + 8, 44, 44);
        ctx.restore();
        textStartX = subBoxX + 68;
      }
    }

    ctx.fillStyle = '#C8A273';
    ctx.font = '700 11px Inter, sans-serif';
    ctx.fillText('ERSATZSPIELER / 6TH MAN', textStartX, subBoxY + 22);

    const subLabel = `${
      subPlayer ? `${subPlayer.name} #${subPlayer.tag}` : 'Unbesetzt'
    }${
      subAgent ? `  •  ${subAgent.name.toUpperCase()} (${subAgent.role})` : ''
    }`;
    ctx.fillStyle = '#ECE8E1';
    ctx.font = fitText(
      ctx,
      subLabel,
      subBoxW - (textStartX - subBoxX) - 16,
      16,
      12,
      '700',
      'Inter, sans-serif'
    );
    ctx.fillText(subLabel, textStartX, subBoxY + 45);
  } else {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#73FBD3';
    ctx.font = '600 13px JetBrains Mono, monospace';
    ctx.fillText('BBT PREMIER TEAM HQ', W - padX - 26, footerY + 48);
  }
  ctx.restore();
}

async function drawPortrait1350p(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  lineup: TeamLineup,
  players: TeamPlayer[],
  logoImg: HTMLImageElement | null,
  mapSplashImg: HTMLImageElement | null,
  mapName: string
) {
  const padX = 48;
  const headerY = 38;
  const totalW = W - padX * 2;

  ctx.save();
  drawRoundedRect(ctx, padX, headerY, totalW, 150, 20);
  ctx.clip();
  if (mapSplashImg) {
    drawCoverImage(ctx, mapSplashImg, padX, headerY, totalW, 150);
  }
  const grad = ctx.createLinearGradient(padX, headerY, padX + totalW, headerY);
  grad.addColorStop(0, 'rgba(10, 12, 16, 0.95)');
  grad.addColorStop(0.65, 'rgba(10, 12, 16, 0.82)');
  grad.addColorStop(1, 'rgba(158, 20, 27, 0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(padX, headerY, totalW, 150);

  ctx.strokeStyle = 'rgba(200, 162, 115, 0.35)';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, padX, headerY, totalW, 150, 20);
  ctx.stroke();

  if (logoImg) {
    ctx.drawImage(logoImg, padX + 24, headerY + 21, 108, 108);
  }

  const textX = padX + 152;
  ctx.fillStyle = '#C8A273';
  ctx.font = '700 14px Inter, sans-serif';
  ctx.fillText('BIGBLACKTEA (BBT)  •  PREMIER TEAM HQ', textX, headerY + 42);

  const title = (lineup.name || `${mapName} Main`).toUpperCase();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = fitText(ctx, title, 520, 42, 24, '800', 'Rajdhani, sans-serif');
  ctx.fillText(title, textX, headerY + 90);

  ctx.fillStyle = '#73FBD3';
  ctx.font = '700 18px Rajdhani, sans-serif';
  ctx.fillText(`MAP: ${mapName.toUpperCase()}`, textX, headerY + 124);
  ctx.restore();

  const row1Y = 214;
  const cardH = 475;
  const gap = 22;
  const cardW = (totalW - gap * 2) / 3;

  for (let i = 0; i < 3; i++) {
    const slot = lineup.slots[i] || {
      slotIndex: i,
      playerId: null,
      agentId: null,
    };
    const cardX = padX + i * (cardW + gap);
    await drawPlayerAgentCard(
      ctx,
      cardX,
      row1Y,
      cardW,
      cardH,
      slot.playerId,
      slot.agentId,
      i + 1,
      players,
      false
    );
  }

  const row2Y = row1Y + cardH + 22;
  const subPlayer = lineup.substitute?.playerId
    ? players.find((p) => p.id === lineup.substitute?.playerId)
    : null;
  const subAgent = lineup.substitute?.agentId
    ? getAgentByIdOrName(lineup.substitute.agentId)
    : null;
  const hasSub = Boolean(subPlayer || subAgent);

  if (hasSub) {
    for (let i = 3; i < 5; i++) {
      const slot = lineup.slots[i] || {
        slotIndex: i,
        playerId: null,
        agentId: null,
      };
      const cardX = padX + (i - 3) * (cardW + gap);
      await drawPlayerAgentCard(
        ctx,
        cardX,
        row2Y,
        cardW,
        cardH,
        slot.playerId,
        slot.agentId,
        i + 1,
        players,
        false
      );
    }
    const subX = padX + 2 * (cardW + gap);
    await drawPlayerAgentCard(
      ctx,
      subX,
      row2Y,
      cardW,
      cardH,
      lineup.substitute?.playerId || null,
      lineup.substitute?.agentId || null,
      6,
      players,
      true
    );
  } else {
    const startX = padX + (totalW - (cardW * 2 + gap)) / 2;
    for (let i = 3; i < 5; i++) {
      const slot = lineup.slots[i] || {
        slotIndex: i,
        playerId: null,
        agentId: null,
      };
      const cardX = startX + (i - 3) * (cardW + gap);
      await drawPlayerAgentCard(
        ctx,
        cardX,
        row2Y,
        cardW,
        cardH,
        slot.playerId,
        slot.agentId,
        i + 1,
        players,
        false
      );
    }
  }

  // Footer
  const footerY = 1214;
  ctx.save();
  drawRoundedRect(ctx, padX, footerY, totalW, 92, 16);
  ctx.fillStyle = 'rgba(14, 16, 22, 0.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(200, 162, 115, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#C8A273';
  ctx.font = '700 22px Rajdhani, sans-serif';
  ctx.fillText('BIGBLACKTEA (BBT)', padX + 26, footerY + 42);

  ctx.fillStyle = '#878C8F';
  ctx.font = '500 15px Inter, sans-serif';
  ctx.fillText('Strategie. Teamwork. Erfolg.', padX + 26, footerY + 68);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#ECE8E1';
  ctx.font = '700 18px Rajdhani, sans-serif';
  ctx.fillText(`MAP: ${mapName.toUpperCase()}`, W - padX - 26, footerY + 42);

  const dateStr = new Date(lineup.updatedAt || Date.now()).toLocaleDateString(
    'de-DE'
  );
  ctx.fillStyle = '#878C8F';
  ctx.font = '500 14px JetBrains Mono, monospace';
  ctx.fillText(`STAND: ${dateStr}`, W - padX - 26, footerY + 68);
  ctx.restore();
}

async function drawPlayerAgentCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  playerId: string | null,
  agentId: string | null,
  slotNumber: number,
  players: TeamPlayer[],
  isSubstitute = false
) {
  const player = playerId ? players.find((p) => p.id === playerId) : null;
  const agent = agentId ? getAgentByIdOrName(agentId) : null;
  const roleAccent = isSubstitute ? '#C8A273' : getRoleColor(agent?.role);

  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, 18);
  ctx.clip();

  // Base Card Gradient
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, '#161A24');
  bg.addColorStop(0.55, '#10131A');
  bg.addColorStop(1, '#090A0E');
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);

  // Subtle Radial Glow behind Agent Portrait
  const glow = ctx.createRadialGradient(
    x + w / 2,
    y + h * 0.36,
    10,
    x + w / 2,
    y + h * 0.36,
    w * 0.78
  );
  glow.addColorStop(
    0,
    isSubstitute ? 'rgba(200, 162, 115, 0.22)' : 'rgba(158, 20, 27, 0.34)'
  );
  glow.addColorStop(1, 'rgba(158, 20, 27, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, w, h);

  // Watermark Agent Name
  if (agent) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.font = '800 62px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(agent.name.toUpperCase(), x + w / 2, y + 88);
    ctx.restore();
  }

  // Slot Badge
  ctx.save();
  ctx.fillStyle = isSubstitute
    ? 'rgba(200, 162, 115, 0.2)'
    : 'rgba(255, 255, 255, 0.06)';
  drawRoundedRect(ctx, x + 16, y + 16, isSubstitute ? 88 : 54, 28, 8);
  ctx.fill();
  ctx.fillStyle = isSubstitute ? '#C8A273' : '#878C8F';
  ctx.font = '700 12px JetBrains Mono, monospace';
  ctx.fillText(isSubstitute ? '6TH SUB' : `#0${slotNumber}`, x + 28, y + 34);
  ctx.restore();

  // Role Icon Top Right
  if (agent?.roleIcon) {
    const rIcon = await loadImage(agent.roleIcon);
    if (rIcon) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.drawImage(rIcon, x + w - 40, y + 18, 22, 22);
      ctx.restore();
    }
  }

  // Full Agent Portrait
  if (agent) {
    const portraitImg =
      (await loadImage(agent.fullPortrait)) ||
      (await loadImage(agent.displayIcon));
    if (portraitImg) {
      const targetH = h * 0.75;
      const aspect = portraitImg.width / portraitImg.height;
      const targetW = targetH * aspect;
      const drawX = x + (w - targetW) / 2;
      const drawY = y + 34;
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.78)';
      ctx.shadowBlur = 22;
      ctx.drawImage(portraitImg, drawX, drawY, targetW, targetH);
      ctx.restore();
    } else {
      ctx.save();
      ctx.fillStyle = '#C8A273';
      ctx.font = '800 28px Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(agent.name.toUpperCase(), x + w / 2, y + h * 0.42);
      ctx.restore();
    }
  } else {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.font = '700 22px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KEIN AGENT', x + w / 2, y + h * 0.42);
    ctx.restore();
  }

  // Bottom Nameplate Overlay
  const plateH = 178;
  const plateY = y + h - plateH;
  const plateGrad = ctx.createLinearGradient(x, plateY - 48, x, y + h);
  plateGrad.addColorStop(0, 'rgba(9, 10, 14, 0)');
  plateGrad.addColorStop(0.28, 'rgba(9, 10, 14, 0.93)');
  plateGrad.addColorStop(1, 'rgba(7, 8, 10, 0.99)');
  ctx.fillStyle = plateGrad;
  ctx.fillRect(x, plateY - 48, w, plateH + 48);

  // Accent Line above Player Name
  const barGrad = ctx.createLinearGradient(x + 20, 0, x + w - 20, 0);
  barGrad.addColorStop(0, isSubstitute ? '#C8A273' : '#9E141B');
  barGrad.addColorStop(0.5, roleAccent);
  barGrad.addColorStop(1, 'rgba(200, 162, 115, 0.15)');
  ctx.fillStyle = barGrad;
  ctx.fillRect(x + 22, y + h - 124, w - 44, 3);

  // Player Name & Tag
  const playerName = player ? player.name : 'Offener Slot';
  const playerTag = player ? `#${player.tag.replace(/^#/, '')}` : '';

  ctx.fillStyle = '#FFFFFF';
  ctx.font = fitText(
    ctx,
    playerName,
    w - 44,
    27,
    16,
    '800',
    'Inter, sans-serif'
  );
  ctx.fillText(playerName, x + 22, y + h - 86);

  if (playerTag) {
    ctx.fillStyle = '#C8A273';
    ctx.font = '600 13px JetBrains Mono, monospace';
    ctx.fillText(playerTag, x + 22, y + h - 63);
  }

  // Agent Name & Role Pill
  const agentLabel = agent ? agent.name.toUpperCase() : 'NICHT ZUGEWIESEN';
  ctx.fillStyle = '#ECE8E1';
  ctx.font = '700 22px Rajdhani, sans-serif';
  ctx.fillText(agentLabel, x + 22, y + h - 26);

  if (agent) {
    const roleText = agent.role.toUpperCase();
    ctx.font = '700 11px Inter, sans-serif';
    const roleW = ctx.measureText(roleText).width + 20;
    const roleX = x + w - roleW - 20;
    const roleY = y + h - 44;

    drawRoundedRect(ctx, roleX, roleY, roleW, 24, 6);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.fill();
    ctx.strokeStyle = roleAccent;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = roleAccent;
    ctx.textAlign = 'center';
    ctx.fillText(roleText, roleX + roleW / 2, roleY + 16);
    ctx.textAlign = 'left';
  }

  // Card Border
  drawRoundedRect(ctx, x, y, w, h, 18);
  ctx.lineWidth = 2;
  ctx.strokeStyle = isSubstitute
    ? 'rgba(200, 162, 115, 0.5)'
    : 'rgba(158, 20, 27, 0.55)';
  ctx.stroke();

  ctx.restore();
}

export function sanitizeExportFilename(input: string): string {
  return (
    input
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '') || 'BBT_Lineup'
  );
}
