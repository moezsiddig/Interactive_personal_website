// Animated network background, used in the hero, in the footer, and
// behind the whole page in dark mode. Yellow nodes drift slowly and
// connect with thin lines, like a neural network / graph.
function initNetwork(canvas, options) {
    if (!canvas || !canvas.getContext) return;

    const ctx = canvas.getContext("2d");
    const fixed = options.fixed === true;  // true = covers the whole screen
    const area = fixed ? document.documentElement : canvas.parentElement;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const LINK_DISTANCE = 150;            // max distance for a line between two nodes
    const MOUSE_DISTANCE = 190;           // max distance for a line to the cursor
    const YELLOW = "255, 215, 0";
    const DENSITY = options.density;      // screen area per node (bigger = fewer nodes)
    const MAX_NODES = options.maxNodes;   // never more nodes than this

    let width = 0;
    let height = 0;
    let nodes = [];
    let mouse = { x: null, y: null };
    let running = false;
    let frameId = null;

    function createNodes() {
        // Number of nodes depends on the area size, with a sensible cap
        const count = Math.min(MAX_NODES, Math.floor((width * height) / DENSITY));
        nodes = [];
        for (let i = 0; i < count; i++) {
            nodes.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.35,
                vy: (Math.random() - 0.5) * 0.35,
                r: Math.random() * 1.8 + 1
            });
        }
    }

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = fixed ? window.innerWidth : area.clientWidth;
        height = fixed ? window.innerHeight : area.clientHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        createNodes();
        draw();
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);

        // Lines between nearby nodes
        for (let i = 0; i < nodes.length; i++) {
            const a = nodes[i];
            for (let j = i + 1; j < nodes.length; j++) {
                const b = nodes[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < LINK_DISTANCE) {
                    ctx.strokeStyle = "rgba(" + YELLOW + "," + (1 - dist / LINK_DISTANCE) * 0.35 + ")";
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                }
            }

            // Lines to the mouse cursor
            if (mouse.x !== null) {
                const dx = a.x - mouse.x;
                const dy = a.y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < MOUSE_DISTANCE) {
                    ctx.strokeStyle = "rgba(" + YELLOW + "," + (1 - dist / MOUSE_DISTANCE) * 0.6 + ")";
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(mouse.x, mouse.y);
                    ctx.stroke();
                }
            }
        }

        // Nodes
        for (const n of nodes) {
            ctx.fillStyle = "rgba(" + YELLOW + ", 0.8)";
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function step() {
        for (const n of nodes) {
            n.x += n.vx;
            n.y += n.vy;
            // Bounce off the edges
            if (n.x < 0 || n.x > width) n.vx *= -1;
            if (n.y < 0 || n.y > height) n.vy *= -1;
        }
        draw();
        frameId = requestAnimationFrame(step);
    }

    // Should this network be running right now?
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

    // Only animate while this area is on screen and the tab is visible
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

    // Turn on/off when dark mode is switched (only for the dark-mode network)
    if (options.onlyInDarkMode) {
        new MutationObserver(function () {
            isAllowed() ? start() : stop();
        }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }

    area.addEventListener("mousemove", function (e) {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
        if (reduceMotion) draw();
    });

    area.addEventListener("mouseleave", function () {
        mouse.x = null;
        mouse.y = null;
        if (reduceMotion) draw();
    });

    let resizeTimer;
    window.addEventListener("resize", function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 150);
    });

    resize();
}

// Start the networks:
// 1) full network in the hero, 2) lighter one in the footer,
// 3) behind the whole page, only while dark mode is on
initNetwork(document.getElementById("networkBg"), { density: 13000, maxNodes: 120 });
initNetwork(document.getElementById("footerNetwork"), { density: 9000, maxNodes: 45 });
initNetwork(document.getElementById("pageNetwork"), { density: 18000, maxNodes: 70, fixed: true, onlyInDarkMode: true });
