// Spider webs and spiders for the whole site.
//
// initSpiderWeb()      draws a web that builds itself. Used in the hero (with a
//                      spider that spins it and hunts), the footer, and the
//                      dark-mode page background (webs without a spider).
// initRoamingSpider()  a spider on a silk thread that wanders along the page
//                      margins once the hero is scrolled out of view.
// drawSpider()         draws one spider; shared by both.

// ===== Drawing one spider (head pointing up before rotating) =====
// onLight = true when it walks over a light background: a soft dark outline
// and slightly darker legs keep it easy to see.
function drawSpider(ctx, x, y, angle, legPhase, moving, scale, onLight) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    if (onLight) {
        ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
        ctx.shadowBlur = 3;
    }

    // 8 legs (4 each side), each with a knee; they swing while walking
    ctx.strokeStyle = onLight ? "#d9a900" : "#FFD700";
    ctx.lineWidth = 1.7;
    ctx.lineCap = "round";
    const baseAngles = [-0.9, -0.35, 0.25, 0.8];
    for (let side = -1; side <= 1; side += 2) {
        for (let k = 0; k < 4; k++) {
            const swing = moving ? Math.sin(legPhase + k * 1.6 + (side > 0 ? Math.PI : 0)) * 0.3 : 0;
            const a = baseAngles[k] + swing;
            const kneeX = side * Math.cos(a) * 12;
            const kneeY = Math.sin(a) * 12 - 6;
            const footX = kneeX + side * Math.cos(a + 0.9) * 11;
            const footY = kneeY + Math.sin(a + 0.9) * 11 + 4;
            ctx.beginPath();
            ctx.moveTo(side * 3, -2);
            ctx.lineTo(kneeX, kneeY);
            ctx.lineTo(footX, footY);
            ctx.stroke();
        }
    }

    // Abdomen (back part) with black stripes
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.ellipse(0, 9, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#0b0b0b";
    ctx.lineWidth = 1.6;
    for (let s = 0; s < 3; s++) {
        ctx.beginPath();
        ctx.moveTo(-5, 6 + s * 4);
        ctx.lineTo(0, 8 + s * 4);
        ctx.lineTo(5, 6 + s * 4);
        ctx.stroke();
    }

    // Head (front part) and two small eyes
    ctx.fillStyle = "#e6c200";
    ctx.beginPath();
    ctx.arc(0, -4, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0b0b0b";
    ctx.beginPath();
    ctx.arc(-2, -6, 1.2, 0, Math.PI * 2);
    ctx.arc(2, -6, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// ===== A web that builds itself =====
// options:
//   place(width, height) -> { x, y, r }  centre and size of the round part
//   spokes          number of straight threads (default 16)
//   speed           build speed multiplier (default 1)
//   fixed           true = covers the whole screen (dark-mode background)
//   onlyInDarkMode  true = only runs while dark mode is on
//   bright          true = brighter threads with a soft glow
// If bugCanvas is given, a spider drops in, spins the web and hunts.
function initSpiderWeb(webCanvas, bugCanvas, options) {
    options = options || {};
    if (!webCanvas || !webCanvas.getContext) return;

    const web = webCanvas.getContext("2d");
    const bug = bugCanvas ? bugCanvas.getContext("2d") : null;
    const hasSpider = bug !== null;
    const fixed = options.fixed === true;
    const area = fixed ? document.documentElement : webCanvas.parentElement;
    const canvases = hasSpider ? [webCanvas, bugCanvas] : [webCanvas];
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ----- Settings -----
    const SPOKES = options.spokes || 16;
    const SPEED = options.speed || 1;
    const DROP_FRAMES = 70;     // spider lowering itself (60 frames = 1 second)
    const SPOKE_FRAMES = 22;    // time for one spoke to shoot out
    const SPOKE_GAP = 8;        // delay between two spokes
    const SPRING = 0.06;        // how strongly a thread point returns home
    const DAMPING = 0.9;        // how quickly the shaking calms down
    const COUPLING = 0.12;      // how much a point pulls its neighbours (ripples)
    const SPIDER_SPEED = 5;     // pixels per frame when walking
    const WEB_COLOR = "255, 215, 0";
    const BRIGHT = options.bright === true;   // stronger threads with a glow (hero)
    const FIRST_PHASE = hasSpider ? "drop" : "spokes";

    // ----- State -----
    let width = 0;
    let height = 0;
    let center = { x: 0, y: 0 };
    let radius = 0;
    let angles = [];
    let edgePoints = [];
    let rings = [];
    let ringRadius = [];
    let dew = [];

    let phase = FIRST_PHASE;    // drop -> spokes -> spiral -> done
    let frame = 0;
    let spiralPos = 0;
    let dewAlpha = 0;

    let mouse = { x: null, y: null, vx: 0, vy: 0 };
    let running = false;
    let frameId = null;

    const spider = { x: 0, y: 0, angle: 0, legPhase: 0, moving: false, state: "build", tx: 0, ty: 0, wait: 0 };

    // Default place for the hero: upper right, away from the photo
    function defaultPlace(w, h) {
        // Phones: a smaller web that stays on the screen (and builds faster)
        if (w < 860) return { x: w * 0.72, y: h * 0.2, r: Math.max(230, Math.min(Math.max(w, h * 0.7) * 0.55, 520)) };
        return { x: w * 0.78, y: h * 0.32, r: Math.max(260, Math.min(Math.max(w, h) * 0.5, 720)) };
    }

    // ===== Building the shape of the web =====
    function buildGeometry() {
        const place = (options.place || defaultPlace)(width, height);
        center = { x: place.x, y: place.y };
        radius = place.r;

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
            const t = Math.max(0, Math.min(tx, ty));
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

    function finishInstantly() {
        phase = "done";
        spiralPos = rings.length * SPOKES;
        dewAlpha = 1;
        if (isTouring()) return;    // the icon tour keeps going in the new size
        spider.x = center.x;
        spider.y = center.y;
        spider.state = "idle";
    }

    function restartBuild() {
        phase = FIRST_PHASE;
        frame = 0;
        spiralPos = 0;
        dewAlpha = 0;
        spider.x = center.x;
        spider.y = -20;
        spider.state = "build";
    }

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = fixed ? window.innerWidth : area.clientWidth;
        const h = fixed ? window.innerHeight : area.clientHeight;
        if (w === width && h === height) return; // nothing changed
        width = w;
        height = h;
        canvases.forEach(function (c) {
            c.width = width * dpr;
            c.height = height * dpr;
            c.style.width = width + "px";
            c.style.height = height + "px";
            c.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
        });

        const wasDone = phase === "done";
        buildGeometry();
        if (reduceMotion || wasDone) {
            finishInstantly();      // already built: show it finished in the new size
        } else {
            restartBuild();         // still building: start again in the new size
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
    // Spokes and rings, in one colour strength and line width
    function drawThreads(spokeAlpha, ringAlpha, lineWidth) {
        web.lineWidth = lineWidth;

        // Spokes: centre -> through every ring -> tied to the edge
        web.strokeStyle = "rgba(" + WEB_COLOR + ", " + spokeAlpha + ")";
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
        if (spiralPos > 0) {
            web.strokeStyle = "rgba(" + WEB_COLOR + ", " + ringAlpha + ")";
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

            // The segment being spun right now
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
    }

    function drawWeb() {
        web.clearRect(0, 0, width, height);
        web.lineCap = "round";
        web.lineWidth = 1;

        // The silk thread the spider lowers itself on (only while dropping,
        // so the finished web stays clean)
        if (hasSpider && phase === "drop") {
            web.strokeStyle = "rgba(255, 255, 255, 0.35)";
            web.beginPath();
            web.moveTo(center.x, 0);
            web.lineTo(center.x, spider.y);
            web.stroke();
        }

        if (BRIGHT) {
            // A wide, faint stroke first: a soft glow around every thread
            drawThreads(0.12, 0.09, 4);
            drawThreads(0.62, 0.5, 1.3);
        } else {
            drawThreads(0.32, 0.24, 1);
        }

        // Dew drops fade in when the web is finished
        if (dewAlpha > 0) {
            web.fillStyle = "rgba(255, 245, 200, " + (BRIGHT ? 0.95 : 0.75) * dewAlpha + ")";
            for (const d of dew) {
                const p = node(d.i, d.j);
                web.beginPath();
                web.arc(p.x, p.y, BRIGHT ? d.size * 1.25 : d.size, 0, Math.PI * 2);
                web.fill();
            }
        }
    }

    function draw() {
        drawWeb();
        if (hasSpider) {
            bug.clearRect(0, 0, width, height);
            drawSpider(bug, spider.x, spider.y, spider.angle, spider.legPhase, spider.moving, width < 860 ? 0.6 : 0.75);
        }
    }

    // ===== Movement =====
    function face(dx, dy) {
        const target = Math.atan2(dy, dx) + Math.PI / 2;
        let diff = target - spider.angle;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest way round
        spider.angle += diff * 0.2;
    }

    function walkTo(tx, ty, speed) {
        const step = speed || SPIDER_SPEED;
        const dx = tx - spider.x;
        const dy = ty - spider.y;
        const dist = Math.hypot(dx, dy);
        if (dist < step) {
            spider.x = tx;
            spider.y = ty;
            spider.moving = false;
            return true;
        }
        spider.x += (dx / dist) * step;
        spider.y += (dy / dist) * step;
        spider.moving = true;
        spider.legPhase += 0.45;
        face(dx, dy);
        return false;
    }

    function stepBuild() {
        frame++;

        if (phase === "drop") {
            const t = clamp01(frame / DROP_FRAMES);
            const eased = 1 - Math.pow(1 - t, 3);
            spider.x = center.x;
            spider.y = -20 + (center.y + 20) * eased;
            spider.angle = Math.PI;      // head down while dropping
            spider.moving = true;
            spider.legPhase += 0.3;
            if (t >= 1) { phase = "spokes"; frame = 0; }

        } else if (phase === "spokes") {
            if (hasSpider) {
                const current = Math.min(SPOKES - 1, Math.floor(frame / SPOKE_GAP));
                face(Math.cos(angles[current]), Math.sin(angles[current]));
                spider.moving = true;
                spider.legPhase += 0.25;
            }
            if (frame >= (SPOKES - 1) * SPOKE_GAP + SPOKE_FRAMES) { phase = "spiral"; frame = 0; }

        } else if (phase === "spiral") {
            // Inner rings are quick, outer rings take longer
            const ring = Math.min(rings.length - 1, Math.floor(spiralPos / SPOKES));
            const framesForRing = (10 + 26 * (ringRadius[ring] / radius)) / SPEED;
            spiralPos += SPOKES / framesForRing;

            const total = rings.length * SPOKES;
            if (spiralPos >= total) {
                spiralPos = total;
                phase = "done";
                spider.state = "return";
            } else if (hasSpider) {
                // The spider sits on the end of the thread it is spinning
                const built = Math.floor(spiralPos);
                const i = Math.floor(built / SPOKES);
                const j = built % SPOKES;
                const head = lerp(node(i, j), node(i, (j + 1) % SPOKES), spiralPos - built);
                face(head.x - spider.x, head.y - spider.y);
                spider.x = head.x;
                spider.y = head.y;
                spider.moving = true;
                spider.legPhase += 0.5;
            }
        }
    }

    // ===== Icon tour: the spider shows the visitor the links printed on the shirt =====
    // Runs once per visit, after the web is finished. The spider walks under each
    // icon, the icon lights up, and a speech bubble says what it opens.
    const tour = options.tour || null;
    let tourStop = 0;
    let tourDelay = 50;          // frames to rest in the web before starting
    let tourPending = false;
    let bubble = null;

    if (hasSpider && tour && tour.links.length) {
        let done = false;
        try { done = sessionStorage.getItem("iconTourDone") === "1"; } catch (e) { /* ignore */ }
        if (done || reduceMotion) {
            tour.container.classList.add("hinted");
        } else {
            tourPending = true;
            bubble = document.createElement("div");
            bubble.className = "spider-bubble";
            bubble.setAttribute("aria-hidden", "true");
            area.appendChild(bubble);
        }
    }

    function isTouring() {
        return spider.state === "tour" || spider.state === "show" || spider.state === "tourEnd";
    }

    // Where the spider stands for one icon: just below it, in canvas coordinates
    function tourPoint(i) {
        const icon = tour.links[i].getBoundingClientRect();
        const box = webCanvas.getBoundingClientRect();
        return { x: icon.left + icon.width / 2 - box.left, y: icon.bottom - box.top + 6 };
    }

    function say(text) {
        bubble.textContent = text;
        bubble.classList.add("show");
    }

    function placeBubble() {
        if (bubble && bubble.classList.contains("show")) {
            bubble.style.transform = "translate(" + spider.x + "px, " + (spider.y + 24) + "px) translateX(-50%)";
        }
    }

    function spotlight(i, on) {
        tour.links[i].classList.toggle("spotlight", on);
    }

    function stepTour() {
        if (spider.state === "tour") {
            const p = tourPoint(tourStop);
            if (walkTo(p.x, p.y, 9)) {       // hurries a little to the shirt
                spider.state = "show";
                spider.wait = 85;
                spotlight(tourStop, true);
                say(tour.links[tourStop].dataset.tour || tour.links[tourStop].title);
            }
        } else if (spider.state === "show") {
            spider.moving = false;
            face(0, -1);                     // look up at the icon
            spider.wait--;
            if (spider.wait <= 0) {
                spotlight(tourStop, false);
                tourStop++;
                if (tourStop < tour.links.length) {
                    spider.state = "tour";
                } else {
                    spider.state = "tourEnd";
                    spider.wait = 130;
                    say(tour.finalText);
                }
            }
        } else if (spider.state === "tourEnd") {
            spider.wait--;
            if (spider.wait <= 0) {
                bubble.classList.remove("show");
                bugCanvas.classList.remove("touring");
                tour.container.classList.add("hinted");
                tourPending = false;
                try { sessionStorage.setItem("iconTourDone", "1"); } catch (e) { /* ignore */ }
                spider.state = "return";     // back home to the middle of the web
            }
        }
        placeBubble();
    }

    function stepAfterBuild() {
        if (dewAlpha < 1) dewAlpha = Math.min(1, dewAlpha + 0.02);
        if (!hasSpider) return;

        if (isTouring()) {
            stepTour();
        } else if (tourPending && (spider.state === "return" || (spider.state === "idle" && --tourDelay <= 0))) {
            // Just finished the web (or rested a moment): go straight to the shirt
            tourStop = 0;
            spider.state = "tour";
            bugCanvas.classList.add("touring");   // walk on top of the photo
            say(tour.introText);
        } else if (spider.state === "return") {
            if (walkTo(center.x, center.y)) spider.state = "idle";
        } else if (spider.state === "hunt") {
            if (walkTo(spider.tx, spider.ty)) { spider.state = "wait"; spider.wait = 50; }
        } else if (spider.state === "wait") {
            spider.wait--;
            if (spider.wait <= 0) spider.state = "return";
        } else {
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
            stepAfterBuild();
        } else {
            stepBuild();
        }
        stepThreads();
        draw();
        frameId = requestAnimationFrame(step);
    }

    // Should this web be moving right now?
    function isAllowed() {
        if (reduceMotion) return false;
        if (options.onlyInDarkMode) return document.body.classList.contains("dark-mode");
        return true;
    }

    function start() {
        if (running || !isAllowed()) return;
        running = true;
        frameId = requestAnimationFrame(step);
    }

    function stop() {
        running = false;
        if (frameId) cancelAnimationFrame(frameId);
    }

    // ===== Events =====
    if (!fixed && "IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
            entries[0].isIntersecting ? start() : stop();
        }).observe(area);
    } else {
        start();
    }

    document.addEventListener("visibilitychange", function () {
        document.hidden ? stop() : start();
    });

    if (options.onlyInDarkMode) {
        new MutationObserver(function () {
            isAllowed() ? start() : stop();
        }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }

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
        if (hasSpider && phase === "done" && speed > 3 && fromCenter < radius * 0.95 &&
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

    // Phones: the page starts scrolling as soon as a finger moves, and from then
    // on the browser stops sending pointer events. Touch events keep coming, so
    // a touch pokes the web, and a swipe plucks the threads under the finger.
    function poke(x, y) {
        for (const ring of rings) {
            for (const p of ring) {
                const dx = p.hx - x;
                const dy = p.hy - y;
                const d = Math.hypot(dx, dy);
                if (d > 0.5 && d < 90) {
                    const f = (1 - d / 90) * 3.5;
                    p.vx += (dx / d) * f;
                    p.vy += (dy / d) * f;
                }
            }
        }
    }

    let lastTouch = null;
    area.addEventListener("touchstart", function (e) {
        const t = e.touches[0];
        const rect = webCanvas.getBoundingClientRect();
        const x = t.clientX - rect.left;
        const y = t.clientY - rect.top;
        poke(x, y);
        lastTouch = { x: t.clientX, y: t.clientY };
        mouse.x = x;
        mouse.y = y;
        mouse.vx = 0;
        mouse.vy = 0;

        // A tap inside the finished web: the spider goes to see what landed
        if (hasSpider && phase === "done" && Math.hypot(x - center.x, y - center.y) < radius * 0.95 &&
            (spider.state === "idle" || spider.state === "hunt")) {
            spider.state = "hunt";
            spider.tx = x;
            spider.ty = y;
        }
    }, { passive: true });

    area.addEventListener("touchmove", function (e) {
        const t = e.touches[0];
        const rect = webCanvas.getBoundingClientRect();
        if (lastTouch) {
            // Use the finger's movement on the screen: while the page scrolls,
            // the finger hardly moves over the web itself
            mouse.vx = (t.clientX - lastTouch.x) * 1.5;
            mouse.vy = (t.clientY - lastTouch.y) * 1.5;
        }
        lastTouch = { x: t.clientX, y: t.clientY };
        mouse.x = t.clientX - rect.left;
        mouse.y = t.clientY - rect.top;
    }, { passive: true });

    area.addEventListener("touchend", function () {
        lastTouch = null;
        mouse.x = null;
        mouse.y = null;
    }, { passive: true });

    // Re-measure when the area changes size; waits 150 ms so it runs once
    let resizeTimer;
    function scheduleResize() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 150);
    }
    if (!fixed && "ResizeObserver" in window) {
        new ResizeObserver(scheduleResize).observe(area);
    } else {
        window.addEventListener("resize", scheduleResize);
    }

    resize();
}

// ===== A spider that visits the page margins once =====
// The first time the hero is scrolled out of view, it lowers itself on a
// silk thread from the top of the screen, wanders slowly along the left and
// right margins (swinging when the page scrolls, running from the mouse),
// then after about 12 seconds climbs back up and does not come back during
// this visit, so it never distracts from reading the page.
function initRoamingSpider(canvas, hero) {
    if (!canvas || !canvas.getContext || !hero) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Already visited in this browser tab? Then stay away.
    try {
        if (sessionStorage.getItem("spiderVisited")) return;
    } catch (e) {
        // Storage blocked: the visit simply happens once per page load
    }

    const ctx = canvas.getContext("2d");
    const CRAWL = 1.6;          // normal speed (pixels per frame)
    const FLEE = 5;             // speed when running away from the mouse
    const CLIMB = 3;            // speed when leaving
    const VISIT_FRAMES = 12 * 60;   // about 12 seconds on screen

    let visitFrames = 0;        // frames spent on screen so far
    let leaving = false;        // climbing back up
    let finished = false;       // gone for this visit

    let width = 0;
    let height = 0;
    let heroVisible = true;
    let running = false;
    let frameId = null;
    let lastScroll = window.scrollY;
    let mouse = { x: null, y: null };

    const s = { x: 0, y: -40, anchorX: 0, angle: 0, legPhase: 0, moving: false,
                tx: 0, ty: 0, pause: 0, alpha: 0, swing: 0, swingV: 0 };

    function narrow() { return width < 900; }

    // A random spot in the left or right margin, away from the content
    function pickTarget() {
        let x;
        if (narrow()) {
            x = width - 18;                                      // phones: right edge only
        } else if (Math.random() < 0.5) {
            x = width * (0.025 + Math.random() * 0.035);         // left margin
        } else {
            x = width * (0.94 + Math.random() * 0.035);          // right margin
        }
        s.tx = x;
        s.ty = height * (0.2 + Math.random() * 0.65);
    }

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        pickTarget();
    }

    // Each time it re-appears it lowers itself from the top again
    function enter() {
        pickTarget();
        s.x = s.anchorX = s.tx;
        s.y = -40;
    }

    function step() {
        // Fade in when the hero is gone, fade out when it comes back
        s.alpha += ((heroVisible || finished ? 0 : 1) - s.alpha) * 0.08;

        // Time to go: climb straight up the thread and leave
        if (!heroVisible && !leaving) visitFrames++;
        if (visitFrames > VISIT_FRAMES && !leaving) {
            leaving = true;
            s.tx = s.x;
            s.ty = -60;
        }
        if (leaving && s.y < -50) {
            finished = true;
            try { sessionStorage.setItem("spiderVisited", "1"); } catch (e) { /* ignore */ }
        }

        // Run away if the mouse comes close (not while leaving)
        let speed = leaving ? CLIMB : CRAWL;
        if (!leaving && mouse.x !== null) {
            const d = Math.hypot(s.x - mouse.x, s.y - mouse.y);
            if (d < 120) {
                speed = FLEE;
                s.ty = Math.min(height * 0.9, Math.max(height * 0.15, s.y + (s.y - mouse.y) / d * 160));
                s.pause = 0;
            }
        }

        // Walk (climb/lower on the thread) towards the target
        const dx = s.tx - s.x;
        const dy = s.ty - s.y;
        const dist = Math.hypot(dx, dy);
        if (dist > speed) {
            s.x += (dx / dist) * speed;
            s.y += (dy / dist) * speed;
            s.moving = true;
            s.legPhase += speed * 0.25;
        } else if (s.pause > 0) {
            s.pause--;
            s.moving = false;
        } else if (!leaving) {
            s.pause = 60 + Math.random() * 180;     // rest 1-4 seconds, then move on
            pickTarget();
        }

        // Scrolling makes it swing; a spring brings it back
        const scrolled = window.scrollY - lastScroll;
        lastScroll = window.scrollY;
        s.swingV += Math.max(-6, Math.min(6, scrolled * 0.08));
        s.swingV += -s.swing * 0.05;
        s.swingV *= 0.9;
        s.swing += s.swingV;

        // The top of the thread follows slowly, so the thread leans and swings
        s.anchorX += (s.x - s.anchorX) * 0.02;
        const drawY = s.y + s.swing;
        const tilt = Math.atan2(s.anchorX - s.x, Math.max(20, drawY));

        ctx.clearRect(0, 0, width, height);
        if (s.alpha > 0.02) {
            // Grey silk on the light page, white silk in dark mode
            const onLight = !document.body.classList.contains("dark-mode");
            ctx.globalAlpha = s.alpha;
            ctx.strokeStyle = onLight ? "rgba(90, 90, 90, 0.45)" : "rgba(255, 255, 255, 0.45)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(s.anchorX, 0);
            ctx.lineTo(s.x, drawY - 14);
            ctx.stroke();
            drawSpider(ctx, s.x, drawY, tilt, s.legPhase, s.moving, narrow() ? 0.7 : 0.9, onLight);
            ctx.globalAlpha = 1;
        }

        // Keep animating while it is visible or still fading out
        if ((!heroVisible && !finished) || s.alpha > 0.02) {
            frameId = requestAnimationFrame(step);
        } else {
            running = false;
        }
    }

    function start() {
        if (running || finished || document.hidden) return;
        running = true;
        frameId = requestAnimationFrame(step);
    }

    new IntersectionObserver(function (entries) {
        const wasVisible = heroVisible;
        heroVisible = entries[0].isIntersecting;
        if (wasVisible && !heroVisible && s.alpha < 0.05 && !leaving) enter();
        start();
    }, { threshold: 0.15 }).observe(hero);

    document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
            running = false;
            cancelAnimationFrame(frameId);
        } else if (!heroVisible) {
            start();
        }
    });

    document.addEventListener("pointermove", function (e) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });
    document.documentElement.addEventListener("pointerleave", function () {
        mouse.x = null;
        mouse.y = null;
    });

    window.addEventListener("resize", resize);
    resize();
}

// ===== Start everything =====
const heroSection = document.getElementById("home");

// 1) Hero: the spider drops in, spins the web and hunts
//    and, once per visit, walks the visitor through the links printed on the shirt
const shirtIcons = document.querySelector(".photo-social-icons");
initSpiderWeb(document.getElementById("spiderWeb"), document.getElementById("spiderBug"), {
    speed: 1.7,   // quicker build, so the tour starts before visitors scroll on
    bright: true, // brighter threads with a soft glow
    tour: shirtIcons ? {
        container: shirtIcons,
        links: shirtIcons.querySelectorAll("a"),
        introText: "Psst! The icons on my shirt are real links",
        finalText: window.matchMedia("(hover: none)").matches ? "Tap one to visit!" : "Click one to visit!"
    } : null
});

// 2) Footer: a fan-shaped web that builds itself when the footer comes into view
initSpiderWeb(document.getElementById("footerWeb"), null, {
    spokes: 20,
    speed: 2,
    place: function (w, h) { return { x: w * 0.5, y: h * 1.15, r: Math.min(w * 0.5, 700) }; }
});

// 3) Dark mode: webs in the top-right and bottom-left corners of the screen
initSpiderWeb(document.getElementById("pageWebTop"), null, {
    fixed: true, onlyInDarkMode: true, spokes: 14, speed: 1.5,
    place: function (w, h) { return { x: w, y: 60, r: Math.max(w, h) * 0.42 }; }
});
initSpiderWeb(document.getElementById("pageWebBottom"), null, {
    fixed: true, onlyInDarkMode: true, spokes: 14, speed: 1.5,
    place: function (w, h) { return { x: 0, y: h, r: Math.max(w, h) * 0.38 }; }
});

// 4) A spider that roams the page once you scroll past the hero
initRoamingSpider(document.getElementById("roamingSpider"), heroSection);
