// Draws a realistic tree behind the "My Process" leaves: a tapered trunk with
// bark, roots on the grass, and curved branches that end exactly at each
// leaf's stem. It measures where the leaves are, so it fits any screen size.
(function () {
    const tree = document.querySelector(".process-tree");
    if (!tree) return;

    const NS = "http://www.w3.org/2000/svg";

    // Wrap the list so the drawing can sit behind it at the same size
    const wrap = document.createElement("div");
    wrap.className = "tree-wrap";
    tree.parentNode.insertBefore(wrap, tree);
    wrap.appendChild(tree);

    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "tree-svg");
    svg.setAttribute("aria-hidden", "true");
    wrap.insertBefore(svg, tree);

    // Colours, textures and shading used by the drawing
    svg.innerHTML =
        '<defs>' +
        '  <linearGradient id="barkShade" x1="0" y1="0" x2="1" y2="0">' +
        '    <stop offset="0" stop-color="#3b220f"/><stop offset="0.35" stop-color="#6d4423"/>' +
        '    <stop offset="0.6" stop-color="#8a5a33"/><stop offset="1" stop-color="#3b220f"/>' +
        '  </linearGradient>' +
        '  <filter id="barkGrain" x="0" y="0" width="100%" height="100%">' +
        '    <feTurbulence type="fractalNoise" baseFrequency="0.08 0.9" numOctaves="3" seed="4" result="n"/>' +
        '    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.15  0 0 0 0 0.08  0 0 0 0 0.03  0 0 0 0.55 0" result="g"/>' +
        '    <feComposite in="g" in2="SourceGraphic" operator="in" result="gi"/>' +
        '    <feBlend in="SourceGraphic" in2="gi" mode="multiply"/>' +
        '  </filter>' +
        '  <radialGradient id="grass" cx="50%" cy="50%" r="50%">' +
        '    <stop offset="0" stop-color="#6c9a3a" stop-opacity="0.9"/>' +
        '    <stop offset="0.7" stop-color="#4f7a2a" stop-opacity="0.45"/>' +
        '    <stop offset="1" stop-color="#4f7a2a" stop-opacity="0"/>' +
        '  </radialGradient>' +
        '</defs>' +
        '<g class="tree-art"></g>';
    const art = svg.querySelector(".tree-art");

    // ----- Geometry helpers -----

    // Point on a quadratic curve at t (0..1)
    function quad(p0, c, p1, t) {
        const u = 1 - t;
        return {
            x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
            y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y
        };
    }

    // A curved limb that is thick at the start (w0) and thin at the end (w1)
    function limb(p0, c, p1, w0, w1) {
        const left = [], right = [];
        const steps = 18;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const p = quad(p0, c, p1, t);
            const q = quad(p0, c, p1, Math.min(1, t + 0.01));
            const r = quad(p0, c, p1, Math.max(0, t - 0.01));
            let dx = q.x - r.x, dy = q.y - r.y;
            const len = Math.hypot(dx, dy) || 1;
            dx /= len; dy /= len;
            const w = (w0 + (w1 - w0) * t) / 2;
            left.push((p.x - dy * w).toFixed(1) + " " + (p.y + dx * w).toFixed(1));
            right.push((p.x + dy * w).toFixed(1) + " " + (p.y - dx * w).toFixed(1));
        }
        return "M" + left.join(" L") + " L" + right.reverse().join(" L") + " Z";
    }

    function path(d, attrs) {
        let s = '<path d="' + d + '"';
        for (const k in attrs) s += " " + k + '="' + attrs[k] + '"';
        return s + "/>";
    }

    // Where a leaf's stem ends, measured inside the tree list
    function stemPoint(leaf) {
        let x = leaf.offsetLeft, y = leaf.offsetTop, el = leaf.offsetParent;
        while (el && el !== tree) {
            x += el.offsetLeft;
            y += el.offsetTop;
            el = el.offsetParent;
        }
        return { x: x + leaf.offsetWidth * 0.485, y: y + leaf.offsetHeight * 0.982 };
    }

    // ----- Drawing -----
    function draw() {
        const w = tree.offsetWidth, h = tree.offsetHeight;
        if (!w || !h) return;
        svg.setAttribute("viewBox", "0 0 " + w + " " + h);
        svg.setAttribute("width", w);
        svg.setAttribute("height", h);

        const narrow = window.matchMedia("(max-width: 760px)").matches;
        const trunkX = narrow ? 31 : w / 2;
        const groundY = h - 34;
        const leaves = Array.prototype.slice.call(tree.querySelectorAll(".branch:not(.fallen) .leaf"));
        if (!leaves.length) return;
        const stems = leaves.map(stemPoint);
        const topY = Math.min.apply(null, stems.map(function (s) { return s.y; })) - 30;

        const base = narrow ? 22 : 40;      // trunk width at the ground
        const top = narrow ? 7 : 10;        // trunk width at the top
        const sway = narrow ? 3 : 7;        // gentle bend in the trunk
        let out = "";

        // Grass at the foot of the tree
        out += '<ellipse cx="' + trunkX + '" cy="' + (groundY + 8) + '" rx="' + (narrow ? 70 : 170) +
            '" ry="' + (narrow ? 12 : 18) + '" fill="url(#grass)"/>';

        // Roots spreading out from the base
        const roots = narrow ? [[-1, 26], [1, 34], [1, 18]] : [[-1, 70], [-1, 38], [1, 64], [1, 34]];
        roots.forEach(function (r) {
            const end = { x: trunkX + r[0] * r[1], y: groundY + 10 };
            const c = { x: trunkX + r[0] * r[1] * 0.35, y: groundY - 2 };
            out += path(limb({ x: trunkX + r[0] * base * 0.2, y: groundY - 18 }, c, end, base * 0.45, 2),
                { fill: "#4a2c14", filter: "url(#barkGrain)" });
        });

        // Trunk: tapered, slightly bent, with bark grain and shading
        const trunk = limb(
            { x: trunkX, y: groundY + 4 },
            { x: trunkX + sway, y: (groundY + topY) / 2 },
            { x: trunkX - sway * 0.4, y: topY },
            base, top
        );
        out += path(trunk, { fill: "url(#barkShade)", filter: "url(#barkGrain)" });

        // Bark cracks running up the trunk
        for (let k = -1; k <= 1; k++) {
            let d = "M" + (trunkX + k * base * 0.18) + " " + (groundY - 4);
            for (let y = groundY - 30; y > topY + 20; y -= 26) {
                const f = (groundY - y) / (groundY - topY);
                const wHere = base + (top - base) * f;
                const x = trunkX + sway * Math.sin(f * Math.PI) * 0.8 + k * wHere * 0.18 + ((y / 26) % 2 ? 1.6 : -1.6);
                d += " L" + x.toFixed(1) + " " + y;
            }
            out += path(d, { fill: "none", stroke: "rgba(30,15,5,0.45)", "stroke-width": "1.3", "stroke-linecap": "round" });
        }

        // Branches: from the trunk, curving up and flowing into each leaf's stem.
        // The end of each branch points the same way as the leaf's stem and is
        // as thin as the stem, so the stem looks like the branch continuing.
        stems.forEach(function (s, i) {
            const leaf = leaves[i];
            const branch = leaf.parentNode;
            const style = getComputedStyle(branch);
            const tilt = parseFloat(style.getPropertyValue("--tilt")) || 0;
            const scale = parseFloat(style.getPropertyValue("--scale")) || 1;

            // Direction of the leaf's stem, from its end up toward the blade
            const a = (tilt - 90) * Math.PI / 180;
            const u = { x: Math.cos(a), y: Math.sin(a) };

            // Width of the stem in the leaf drawing (4.5 of 200 units)
            const stemWidth = Math.max(2.4, 4.5 * leaf.offsetWidth / 200 * scale);

            const reach = Math.abs(s.x - trunkX);
            const startY = s.y + reach * 0.5;
            const f = (groundY - startY) / (groundY - topY);
            const startX = trunkX + sway * Math.sin(f * Math.PI) * 0.8;
            const start = { x: startX, y: startY };
            // Control point behind the stem, along its direction: the curve
            // arrives at the stem already pointing the same way
            const ctrl = { x: s.x - u.x * reach * 0.5, y: s.y - u.y * reach * 0.5 };
            // End a little inside the stem so there is no gap
            const end = { x: s.x + u.x * 5, y: s.y + u.y * 5 };
            const thick = narrow ? 7 : 11;
            out += path(limb(start, ctrl, end, thick, stemWidth),
                { fill: "#5e391b", filter: "url(#barkGrain)" });

            // Small swelling (node) where the stem joins the twig
            out += '<ellipse cx="' + s.x.toFixed(1) + '" cy="' + s.y.toFixed(1) + '" rx="' +
                (stemWidth * 0.95).toFixed(1) + '" ry="' + (stemWidth * 0.75).toFixed(1) +
                '" fill="#4a2c14" transform="rotate(' + tilt + ' ' + s.x.toFixed(1) + ' ' + s.y.toFixed(1) + ')"/>';

            // A small side twig on every other branch
            if (i % 2 === 0) {
                const dir = s.x < trunkX ? -1 : 1;
                const mid = quad(start, ctrl, end, 0.45);
                out += path(limb(mid, { x: mid.x + dir * 10, y: mid.y - 12 },
                    { x: mid.x + dir * 16, y: mid.y - (narrow ? 16 : 26) }, 3.2, 0.8),
                    { fill: "#5e391b" });
            }
        });

        // Two small twigs at the very top of the trunk
        const crown = { x: trunkX - sway * 0.4, y: topY + 4 };
        [-1, 1].forEach(function (dir) {
            out += path(limb(crown, { x: crown.x + dir * 8, y: crown.y - 14 },
                { x: crown.x + dir * (narrow ? 12 : 20), y: crown.y - (narrow ? 20 : 30) }, top * 0.7, 1),
                { fill: "#5e391b" });
        });

        art.innerHTML = out;
        tree.classList.add("tree-drawn");
    }

    // Redraw when the size changes (window, fonts, phone rotation)
    let timer;
    function schedule() {
        clearTimeout(timer);
        timer = setTimeout(draw, 80);
    }
    if ("ResizeObserver" in window) {
        new ResizeObserver(schedule).observe(tree);
    }
    window.addEventListener("resize", schedule);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
    draw();
})();
