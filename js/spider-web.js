// Spider web for the hero section.
// A spider drops in on a silk thread, the spokes shoot out, then the spider
// walks a spiral and builds the web ring by ring. When it is finished, the
// spider rests in the centre; if the mouse plucks a thread, the spider runs
// to the vibration (like catching prey) and then walks back home.
// Two canvases: one for the web (behind the dark overlay) and one for the
// spider (above the overlay, below the text).
function initSpiderWeb(webCanvas, bugCanvas) {
    if (!webCanvas || !bugCanvas || !webCanvas.getContext) return;

    const web = webCanvas.getContext("2d");
    const bug = bugCanvas.getContext("2d");
    const area = webCanvas.parentElement;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ----- Settings -----
    const SPOKES = 16;          // straight threads from the centre
    const DROP_FRAMES = 70;     // spider lowering itself (60 frames = 1 second)
    const SPOKE_FRAMES = 22;    // time for one spoke to shoot out
    const SPOKE_GAP = 8;        // delay between two spokes
    const SPRING = 0.06;        // how strongly a thread point returns home
    const DAMPING = 0.9;        // how quickly the shaking calms down
    const COUPLING = 0.12;      // how much a point pulls its neighbours (ripples)
    const SPIDER_SPEED = 5;     // pixels per frame when walking
    const WEB_COLOR = "255, 215, 0";

    // ----- State -----
    let width = 0;
    let height = 0;
    let center = { x: 0, y: 0 };
    let radius = 0;             // size of the round part of the web
    let angles = [];            // direction of each spoke
    let edgePoints = [];        // where each spoke is tied to the edge of the hero
    let rings = [];             // rings[i][j] = point on ring i, spoke j
    let ringRadius = [];
    let dew = [];

    let phase = "drop";         // drop -> spokes -> spiral -> done
    let frame = 0;              // frames since the current phase started
    let spiralPos = 0;          // how many ring segments are built (can be fractional)
    let dewAlpha = 0;

    let mouse = { x: null, y: null, vx: 0, vy: 0 };
    let running = false;
    let frameId = null;

    const spider = { x: 0, y: 0, angle: 0, legPhase: 0, moving: false, state: "build", tx: 0, ty: 0, wait: 0 };

    // ===== Building the shape of the web =====
    function buildGeometry() {
        const narrow = width < 860;
        center = narrow
            ? { x: width * 0.72, y: height * 0.2 }
            : { x: width * 0.78, y: height * 0.32 };
        radius = Math.max(260, Math.min(Math.max(width, height) * 0.5, 720));

        angles = [];
        for (let j = 0; j < SPOKES; j++) {
            angles.push((j / SPOKES) * Math.PI * 2 + (Math.random() - 0.5) * 0.14);
        }

        // Each spoke continues in a straight line until it meets the edge
        edgePoints = angles.map(function (a) {
            const dx = Math.cos(a);
            const dy = Math.sin(a);
            const tx = dx > 0 ? (width - center.x) / dx : dx < 0 ? -center.x / dx : Infinity;
            const ty = dy > 0 ? (height - center.y) / dy : dy < 0 ? -center.y / dy : Infinity;
            const t = Math.min(tx, ty);
            return { x: center.x + dx * t, y: center.y + dy * t };
        });

        // Rings get further apart the further they are from the centre
        rings = [];
        ringRadius = [];
        let r = 12;
        while (r < radius) {
            ringRadius.push(r);
            const ringR = r;
            rings.push(angles.map(function (a) {
                const rr = ringR * (0.97 + Math.random() * 0.06);
                return { hx: center.x + Math.cos(a) * rr, hy: center.y + Math.sin(a) * rr, ox: 0, oy: 0, vx: 0, vy: 0 };
            }));
            r += 12 + r * 0.09;
        }

        dew = [];
        for (let k = 0; k < 30; k++) {
            dew.push({
                i: Math.floor(Math.random() * rings.length),
                j: Math.floor(Math.random() * SPOKES),
                size: Math.random() * 1.6 + 0.8
            });
        }
    }

    // Show the finished web straight away (after a resize, or for reduced motion)
    function finishInstantly() {
        phase = "done";
        spiralPos = rings.length * SPOKES;
        dewAlpha = 1;
        spider.x = center.x;
        spider.y = center.y;
        spider.state = "idle";
    }

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (area.clientWidth === width && area.clientHeight === height) return; // nothing changed
        width = area.clientWidth;
        height = area.clientHeight;
        [webCanvas, bugCanvas].forEach(function (c) {
            c.width = width * dpr;
            c.height = height * dpr;
            c.style.width = width + "px";
            c.style.height = height + "px";
        });
        web.setTransform(dpr, 0, 0, dpr, 0, 0);
        bug.setTransform(dpr, 0, 0, dpr, 0, 0);

        const wasDone = phase === "done";
        buildGeometry();
        if (reduceMotion || wasDone) {
            // Already built: show the finished web in the new size
            finishInstantly();
        } else {
            // Still building: start the building show again in the new size
            phase = "drop";
            frame = 0;
            spiralPos = 0;
            dewAlpha = 0;
            spider.x = center.x;
            spider.y = -20;
            spider.state = "build";
        }
        draw();
    }

    // ===== Small helpers =====
    function node(i, j) {
        const p = rings[i][j];
        return { x: p.hx + p.ox, y: p.hy + p.oy };
    }

    function lerp(a, b, t) {
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }

    function clamp01(v) {
        return Math.max(0, Math.min(1, v));
    }

    // How far each spoke has grown (0 = not started, 1 = reaches the edge)
    function spokeProgress(j) {
        if (phase === "drop") return 0;
        if (phase !== "spokes") return 1;
        return clamp01((frame - j * SPOKE_GAP) / SPOKE_FRAMES);
    }

    // Draw a line through several points, but only the first part of it
    function drawPartialLine(points, progress) {
        let total = 0;
        for (let k = 1; k < points.length; k++) {
            total += Math.hypot(points[k].x - points[k - 1].x, points[k].y - points[k - 1].y);
        }
        let left = total * progress;
        web.beginPath();
        web.moveTo(points[0].x, points[0].y);
        for (let k = 1; k < points.length && left > 0; k++) {
            const a = points[k - 1];
            const b = points[k];
            const len = Math.hypot(b.x - a.x, b.y - a.y);
            if (len <= left) {
                web.lineTo(b.x, b.y);
                left -= len;
            } else {
                const end = lerp(a, b, left / len);
                web.lineTo(end.x, end.y);
                left = 0;
            }
        }
        web.stroke();
    }

    // ===== Drawing =====
    function drawWeb() {
        web.clearRect(0, 0, width, height);
        web.lineCap = "round";
        web.lineWidth = 1;

        // The first thread: from the top down to the centre
        web.strokeStyle = "rgba(255, 255, 255, 0.35)";
        web.beginPath();
        web.moveTo(center.x, 0);
        web.lineTo(center.x, phase === "drop" ? spider.y : center.y);
        web.stroke();

        // Spokes: centre -> through every ring -> tied to the edge
        web.strokeStyle = "rgba(" + WEB_COLOR + ", 0.32)";
        for (let j = 0; j < SPOKES; j++) {
            const p = spokeProgress(j);
            if (p <= 0) continue;
            const points = [center];
            for (let i = 0; i < rings.length; i++) points.push(node(i, j));
            points.push(edgePoints[j]);
            drawPartialLine(points, p);
        }

        // Rings: each segment sags a little towards the centre, like real silk
        const built = Math.floor(spiralPos);
        if (built > 0 || spiralPos > 0) {
            web.strokeStyle = "rgba(" + WEB_COLOR + ", 0.24)";
            web.beginPath();
            for (let k = 0; k < built; k++) {
                const i = Math.floor(k / SPOKES);
                const j = k % SPOKES;
                const a = node(i, j);
                const b = node(i, (j + 1) % SPOKES);
                if (j === 0) web.moveTo(a.x, a.y);
                const mid = lerp(a, b, 0.5);
                const sag = lerp(mid, center, 0.06);
                web.quadraticCurveTo(sag.x, sag.y, b.x, b.y);
            }
            web.stroke();

            // The segment the spider is spinning right now
            if (phase === "spiral" && built < rings.length * SPOKES) {
                const i = Math.floor(built / SPOKES);
                const j = built % SPOKES;
                const a = node(i, j);
                const end = lerp(a, node(i, (j + 1) % SPOKES), spiralPos - built);
                web.beginPath();
                web.moveTo(a.x, a.y);
                web.lineTo(end.x, end.y);
                web.stroke();
            }
        }

        // Dew drops fade in when the web is finished
        if (dewAlpha > 0) {
            web.fillStyle = "rgba(255, 245, 200, " + 0.75 * dewAlpha + ")";
            for (const d of dew) {
                const p = node(d.i, d.j);
                web.beginPath();
                web.arc(p.x, p.y, d.size, 0, Math.PI * 2);
                web.fill();
            }
        }
    }

    function drawSpider() {
        bug.clearRect(0, 0, width, height);
        bug.save();
        bug.translate(spider.x, spider.y);
        bug.rotate(spider.angle);
        const scale = width < 860 ? 0.85 : 1;
        bug.scale(scale, scale);

        // 8 legs (4 each side), each with a knee; they swing while walking
        bug.strokeStyle = "#FFD700";
        bug.lineWidth = 1.7;
        bug.lineCap = "round";
        const baseAngles = [-0.9, -0.35, 0.25, 0.8];
        for (let side = -1; side <= 1; side += 2) {
            for (let k = 0; k < 4; k++) {
                const swing = spider.moving ? Math.sin(spider.legPhase + k * 1.6 + (side > 0 ? Math.PI : 0)) * 0.3 : 0;
                const a = baseAngles[k] + swing;
                const kneeX = side * Math.cos(a) * 12;
                const kneeY = Math.sin(a) * 12 - 6;
                const footX = kneeX + side * Math.cos(a + 0.9) * 11;
                const footY = kneeY + Math.sin(a + 0.9) * 11 + 4;
                bug.beginPath();
                bug.moveTo(side * 3, -2);
                bug.lineTo(kneeX, kneeY);
                bug.lineTo(footX, footY);
                bug.stroke();
            }
        }

        // Abdomen (back part) with black stripes
        bug.fillStyle = "#FFD700";
        bug.beginPath();
        bug.ellipse(0, 9, 8, 10, 0, 0, Math.PI * 2);
        bug.fill();
        bug.strokeStyle = "#0b0b0b";
        bug.lineWidth = 1.6;
        for (let s = 0; s < 3; s++) {
            bug.beginPath();
            bug.moveTo(-5, 6 + s * 4);
            bug.lineTo(0, 8 + s * 4);
            bug.lineTo(5, 6 + s * 4);
            bug.stroke();
        }

        // Head (front part) and two small eyes
        bug.fillStyle = "#e6c200";
        bug.beginPath();
        bug.arc(0, -4, 5.5, 0, Math.PI * 2);
        bug.fill();
        bug.fillStyle = "#0b0b0b";
        bug.beginPath();
        bug.arc(-2, -6, 1.2, 0, Math.PI * 2);
        bug.arc(2, -6, 1.2, 0, Math.PI * 2);
        bug.fill();

        bug.restore();
    }

    function draw() {
        drawWeb();
        drawSpider();
    }

    // ===== Movement =====

    // Turn the spider smoothly to face an angle (its head is drawn pointing up)
    function face(dx, dy) {
        const target = Math.atan2(dy, dx) + Math.PI / 2;
        let diff = target - spider.angle;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest way round
        spider.angle += diff * 0.2;
    }

    // Walk towards (tx, ty); returns true when arrived
    function walkTo(tx, ty) {
        const dx = tx - spider.x;
        const dy = ty - spider.y;
        const dist = Math.hypot(dx, dy);
        if (dist < SPIDER_SPEED) {
            spider.x = tx;
            spider.y = ty;
            spider.moving = false;
            return true;
        }
        spider.x += (dx / dist) * SPIDER_SPEED;
        spider.y += (dy / dist) * SPIDER_SPEED;
        spider.moving = true;
        spider.legPhase += 0.45;
        face(dx, dy);
        return false;
    }

    function stepBuild() {
        frame++;

        if (phase === "drop") {
            // Lower down the first thread to the centre
            const t = clamp01(frame / DROP_FRAMES);
            const eased = 1 - Math.pow(1 - t, 3);
            spider.x = center.x;
            spider.y = -20 + (center.y + 20) * eased;
            spider.angle = Math.PI;      // head down while dropping
            spider.moving = true;
            spider.legPhase += 0.3;
            if (t >= 1) { phase = "spokes"; frame = 0; }

        } else if (phase === "spokes") {
            // Stay in the centre and turn to face each new spoke
            const current = Math.min(SPOKES - 1, Math.floor(frame / SPOKE_GAP));
            face(Math.cos(angles[current]), Math.sin(angles[current]));
            spider.moving = true;
            spider.legPhase += 0.25;
            if (frame >= (SPOKES - 1) * SPOKE_GAP + SPOKE_FRAMES) { phase = "spiral"; frame = 0; }

        } else if (phase === "spiral") {
            // Inner rings are quick, outer rings take longer
            const ring = Math.min(rings.length - 1, Math.floor(spiralPos / SPOKES));
            const framesForRing = 10 + 26 * (ringRadius[ring] / radius);
            spiralPos += SPOKES / framesForRing;

            const total = rings.length * SPOKES;
            if (spiralPos >= total) {
                spiralPos = total;
                phase = "done";
                spider.state = "return";
            } else {
                // The spider sits on the end of the thread it is spinning
                const built = Math.floor(spiralPos);
                const i = Math.floor(built / SPOKES);
                const j = built % SPOKES;
                const a = node(i, j);
                const b = node(i, (j + 1) % SPOKES);
                const head = lerp(a, b, spiralPos - built);
                face(head.x - spider.x, head.y - spider.y);
                spider.x = head.x;
                spider.y = head.y;
                spider.moving = true;
                spider.legPhase += 0.5;
            }
        }
    }

    function stepSpiderAfterBuild() {
        if (dewAlpha < 1) dewAlpha = Math.min(1, dewAlpha + 0.02);

        if (spider.state === "return") {
            if (walkTo(center.x, center.y)) spider.state = "idle";
        } else if (spider.state === "hunt") {
            if (walkTo(spider.tx, spider.ty)) { spider.state = "wait"; spider.wait = 50; }
        } else if (spider.state === "wait") {
            spider.wait--;
            if (spider.wait <= 0) spider.state = "return";
        } else {
            // Idle in the centre: slowly look towards the mouse
            spider.moving = false;
            if (mouse.x !== null) face(mouse.x - spider.x, mouse.y - spider.y);
        }
    }

    function stepThreads() {
        for (let i = 0; i < rings.length; i++) {
            for (let j = 0; j < SPOKES; j++) {
                const p = rings[i][j];

                // Pull towards neighbours so a touch spreads as a ripple
                let nx = 0, ny = 0, n = 0;
                const neighbours = [rings[i][(j + 1) % SPOKES], rings[i][(j + SPOKES - 1) % SPOKES]];
                if (i > 0) neighbours.push(rings[i - 1][j]);
                if (i < rings.length - 1) neighbours.push(rings[i + 1][j]);
                for (const q of neighbours) { nx += q.ox; ny += q.oy; n++; }

                p.vx += -p.ox * SPRING + (nx / n - p.ox) * COUPLING;
                p.vy += -p.oy * SPRING + (ny / n - p.oy) * COUPLING;

                // The mouse "plucks" threads it moves across
                if (mouse.x !== null) {
                    const d = Math.hypot(p.hx - mouse.x, p.hy - mouse.y);
                    if (d < 50) {
                        const f = (1 - d / 50) * 0.12;
                        p.vx += mouse.vx * f;
                        p.vy += mouse.vy * f;
                    }
                }

                p.vx *= DAMPING;
                p.vy *= DAMPING;
                p.ox += p.vx;
                p.oy += p.vy;
            }
        }
        mouse.vx *= 0.5;
        mouse.vy *= 0.5;
    }

    function step() {
        if (phase === "done") {
            stepSpiderAfterBuild();
        } else {
            stepBuild();
        }
        stepThreads();
        draw();
        frameId = requestAnimationFrame(step);
    }

    function start() {
        if (running || reduceMotion) return;
        running = true;
        frameId = requestAnimationFrame(step);
    }

    function stop() {
        running = false;
        if (frameId) cancelAnimationFrame(frameId);
    }

    // ===== Events =====
    if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
            entries[0].isIntersecting ? start() : stop();
        }).observe(area);
    } else {
        start();
    }

    document.addEventListener("visibilitychange", function () {
        document.hidden ? stop() : start();
    });

    // pointer events work for both mouse and touch
    area.addEventListener("pointermove", function (e) {
        const rect = webCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (mouse.x !== null) {
            mouse.vx = x - mouse.x;
            mouse.vy = y - mouse.y;
        }
        mouse.x = x;
        mouse.y = y;

        // A strong pluck inside the finished web: the spider goes to catch it
        const speed = Math.hypot(mouse.vx, mouse.vy);
        const fromCenter = Math.hypot(x - center.x, y - center.y);
        if (phase === "done" && speed > 3 && fromCenter < radius * 0.95 &&
            (spider.state === "idle" || spider.state === "hunt")) {
            spider.state = "hunt";
            spider.tx = x;
            spider.ty = y;
        }
    });

    area.addEventListener("pointerleave", function () {
        mouse.x = null;
        mouse.y = null;
    });

    // Re-measure whenever the hero changes size (window resize, fonts or images
    // finishing loading, phone rotation...). Waits 150 ms so it runs only once.
    let resizeTimer;
    function scheduleResize() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 150);
    }
    if ("ResizeObserver" in window) {
        new ResizeObserver(scheduleResize).observe(area);
    } else {
        window.addEventListener("resize", scheduleResize);
    }

    resize();
}

initSpiderWeb(document.getElementById("spiderWeb"), document.getElementById("spiderBug"));
