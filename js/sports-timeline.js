(() => {
    const stage = document.querySelector("[data-sport-timeline]");
    if (!stage) return;

    const cards = Array.from(stage.querySelectorAll("[data-sport-card]"));
    const line = stage.querySelector("[data-sport-timeline-line]");
    if (cards.length < 2 || !line) return;

    const nodes = cards.map((card) => ({
        card,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        homeX: 0,
        homeY: 0,
        width: 0,
        height: 0
    }));

    let activePointer = null;
    let frame = 0;
    let previousTime = 0;
    let initialized = false;
    let stageWidth = 0;
    let stageHeight = 0;

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const isCompact = () => window.matchMedia("(max-width: 600px)").matches;

    function updateDimensions() {
        const rect = stage.getBoundingClientRect();
        const oldWidth = stageWidth;
        const oldHeight = stageHeight;
        stageWidth = rect.width;
        stageHeight = rect.height;

        nodes.forEach((node) => {
            const cardRect = node.card.getBoundingClientRect();
            node.width = cardRect.width;
            node.height = cardRect.height;
        });

        if (!initialized) {
            const compact = isCompact();
            const xStops = compact
                ? [0.34, 0.66, 0.34, 0.66, 0.34, 0.66]
                : [0.17, 0.5, 0.83, 0.83, 0.5, 0.17];
            const yStops = compact
                ? [0.08, 0.245, 0.41, 0.575, 0.74, 0.905]
                : [0.28, 0.28, 0.28, 0.72, 0.72, 0.72];

            nodes.forEach((node, index) => {
                node.x = clamp(xStops[index] * stageWidth, node.width / 2 + 8, stageWidth - node.width / 2 - 8);
                node.y = clamp(yStops[index] * stageHeight, node.height / 2 + 8, stageHeight - node.height / 2 - 8);
                node.homeX = node.x;
                node.homeY = node.y;
            });
            initialized = true;
        } else if (oldWidth && oldHeight && (oldWidth !== stageWidth || oldHeight !== stageHeight)) {
            nodes.forEach((node) => {
                node.x = clamp(node.x * stageWidth / oldWidth, node.width / 2 + 8, stageWidth - node.width / 2 - 8);
                node.y = clamp(node.y * stageHeight / oldHeight, node.height / 2 + 8, stageHeight - node.height / 2 - 8);
                node.homeX = clamp(node.homeX * stageWidth / oldWidth, node.width / 2 + 8, stageWidth - node.width / 2 - 8);
                node.homeY = clamp(node.homeY * stageHeight / oldHeight, node.height / 2 + 8, stageHeight - node.height / 2 - 8);
            });
            solveOverlaps();
            nodes.forEach((node) => {
                node.homeX = node.x;
                node.homeY = node.y;
            });
            ensureAnimation();
        }

        render();
        drawLine();
    }

    function solveOverlaps() {
        for (let iteration = 0; iteration < 6; iteration += 1) {
            for (let firstIndex = 0; firstIndex < nodes.length; firstIndex += 1) {
                const first = nodes[firstIndex];
                for (let secondIndex = firstIndex + 1; secondIndex < nodes.length; secondIndex += 1) {
                    const second = nodes[secondIndex];
                    const dx = second.x - first.x;
                    const dy = second.y - first.y;
                    const overlapX = (first.width + second.width) / 2 + 18 - Math.abs(dx);
                    const overlapY = (first.height + second.height) / 2 + 18 - Math.abs(dy);
                    if (overlapX <= 0 || overlapY <= 0) continue;

                    const firstDragged = activePointer && activePointer.index === firstIndex;
                    const secondDragged = activePointer && activePointer.index === secondIndex;
                    const pushFirst = firstDragged ? 0.7 : secondDragged ? 0.3 : 0.5;
                    const pushSecond = secondDragged ? 0.7 : firstDragged ? 0.3 : 0.5;
                    const directionX = dx < 0 ? -1 : 1;
                    const directionY = dy < 0 ? -1 : 1;
                    const availableX = (directionX > 0
                        ? first.x - (first.width / 2 + 8)
                        : stageWidth - first.width / 2 - 8 - first.x)
                        + (directionX > 0
                            ? stageWidth - second.width / 2 - 8 - second.x
                            : second.x - (second.width / 2 + 8));
                    const availableY = (directionY > 0
                        ? first.y - (first.height / 2 + 8)
                        : stageHeight - first.height / 2 - 8 - first.y)
                        + (directionY > 0
                            ? stageHeight - second.height / 2 - 8 - second.y
                            : second.y - (second.height / 2 + 8));
                    const canSeparateHorizontally = availableX >= overlapX;
                    const canSeparateVertically = availableY >= overlapY;
                    const moveHorizontally = canSeparateHorizontally && (!canSeparateVertically || overlapX < overlapY)
                        || !canSeparateVertically && !canSeparateHorizontally && availableX / overlapX >= availableY / overlapY;
                    if (moveHorizontally) {
                        first.x -= directionX * overlapX * pushFirst;
                        second.x += directionX * overlapX * pushSecond;
                    } else {
                        first.y -= directionY * overlapY * pushFirst;
                        second.y += directionY * overlapY * pushSecond;
                    }
                }
            }

            nodes.forEach((node) => {
                if (activePointer && nodes[activePointer.index] === node) return;
                node.x = clamp(node.x, node.width / 2 + 8, stageWidth - node.width / 2 - 8);
                node.y = clamp(node.y, node.height / 2 + 8, stageHeight - node.height / 2 - 8);
            });
        }
    }

    function render() {
        nodes.forEach((node) => {
            node.card.style.left = `${node.x - node.width / 2}px`;
            node.card.style.top = `${node.y - node.height / 2}px`;
        });
    }

    function drawLine() {
        const points = nodes.map(({ x, y }) => ({ x, y }));
        const last = points.length - 1;
        const incomingX = points[last].x - points[last - 1].x;
        const incomingY = points[last].y - points[last - 1].y;
        const incomingLength = Math.hypot(incomingX, incomingY) || 1;
        const directionX = incomingX / incomingLength;
        const directionY = incomingY / incomingLength;
        const lastNode = nodes[last];
        const edgeDistance = Math.min(
            lastNode.width / 2 / Math.max(Math.abs(directionX), 0.001),
            lastNode.height / 2 / Math.max(Math.abs(directionY), 0.001)
        );
        points[last] = {
            x: points[last].x - directionX * edgeDistance,
            y: points[last].y - directionY * edgeDistance
        };

        let path = `M ${points[0].x} ${points[0].y}`;
        for (let index = 0; index < points.length - 1; index += 1) {
            const previous = points[Math.max(0, index - 1)];
            const start = points[index];
            const end = points[index + 1];
            const next = points[Math.min(points.length - 1, index + 2)];
            const control1X = start.x + (end.x - previous.x) / 6;
            const control1Y = start.y + (end.y - previous.y) / 6;
            const control2X = end.x - (next.x - start.x) / 6;
            const control2Y = end.y - (next.y - start.y) / 6;
            path += ` C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${end.x} ${end.y}`;
        }
        line.setAttribute("d", path);
    }

    function commitPositions() {
        solveOverlaps();
        nodes.forEach((node) => {
            node.homeX = node.x;
            node.homeY = node.y;
        });
        render();
        drawLine();
    }

    function animate(time) {
        if (!previousTime) previousTime = time;
        const elapsed = Math.min((time - previousTime) / 16.67, 2.5);
        previousTime = time;
        const forces = nodes.map(() => ({ x: 0, y: 0 }));

        nodes.forEach((node, index) => {
            if (activePointer && activePointer.index === index) return;
            forces[index].x += (node.homeX - node.x) * 0.018;
            forces[index].y += (node.homeY - node.y) * 0.018;
        });

        for (let index = 0; index < nodes.length - 1; index += 1) {
            const first = nodes[index];
            const second = nodes[index + 1];
            const dx = second.x - first.x;
            const dy = second.y - first.y;
            const distance = Math.hypot(dx, dy) || 1;
            const homeDistance = Math.hypot(second.homeX - first.homeX, second.homeY - first.homeY);
            const spring = (distance - homeDistance) * 0.024;
            const forceX = dx / distance * spring;
            const forceY = dy / distance * spring;

            if (!activePointer || activePointer.index !== index) {
                forces[index].x += forceX;
                forces[index].y += forceY;
            }
            if (!activePointer || activePointer.index !== index + 1) {
                forces[index + 1].x -= forceX;
                forces[index + 1].y -= forceY;
            }
        }

        for (let index = 1; index < nodes.length - 1; index += 1) {
            const previous = nodes[index - 1];
            const current = nodes[index];
            const next = nodes[index + 1];
            const bendX = previous.x - 2 * current.x + next.x
                - (previous.homeX - 2 * current.homeX + next.homeX);
            const bendY = previous.y - 2 * current.y + next.y
                - (previous.homeY - 2 * current.homeY + next.homeY);
            const forceX = bendX * 0.008;
            const forceY = bendY * 0.008;

            if (!activePointer || activePointer.index !== index - 1) {
                forces[index - 1].x -= forceX;
                forces[index - 1].y -= forceY;
            }
            if (!activePointer || activePointer.index !== index) {
                forces[index].x += forceX * 2;
                forces[index].y += forceY * 2;
            }
            if (!activePointer || activePointer.index !== index + 1) {
                forces[index + 1].x -= forceX;
                forces[index + 1].y -= forceY;
            }
        }

        nodes.forEach((node, index) => {
            if (activePointer && activePointer.index === index) return;
            node.vx = (node.vx + forces[index].x * elapsed) * 0.84;
            node.vy = (node.vy + forces[index].y * elapsed) * 0.84;
            node.x += node.vx * elapsed;
            node.y += node.vy * elapsed;
        });

        solveOverlaps();
        render();
        drawLine();

        const settled = !activePointer && nodes.every((node) =>
            Math.abs(node.x - node.homeX) < 0.15
            && Math.abs(node.y - node.homeY) < 0.15
            && Math.abs(node.vx) < 0.04
            && Math.abs(node.vy) < 0.04
        );
        if (settled) {
            nodes.forEach((node) => {
                node.x = node.homeX;
                node.y = node.homeY;
                node.vx = 0;
                node.vy = 0;
            });
            render();
            drawLine();
            frame = 0;
            previousTime = 0;
            return;
        }
        frame = window.requestAnimationFrame(animate);
    }

    function ensureAnimation() {
        if (!frame) {
            previousTime = 0;
            frame = window.requestAnimationFrame(animate);
        }
    }

    function pointerPosition(event) {
        const rect = stage.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function startDrag(event, index) {
        if (event.button !== undefined && event.button !== 0) return;
        event.preventDefault();
        const point = pointerPosition(event);
        activePointer = {
            index,
            pointerId: event.pointerId,
            offsetX: point.x - nodes[index].x,
            offsetY: point.y - nodes[index].y
        };
        nodes[index].card.classList.add("is-dragging");
        nodes[index].card.setPointerCapture(event.pointerId);
        ensureAnimation();
    }

    function moveDrag(event, index) {
        if (!activePointer || activePointer.index !== index || activePointer.pointerId !== event.pointerId) return;
        const point = pointerPosition(event);
        const node = nodes[index];
        node.x = clamp(point.x - activePointer.offsetX, node.width / 2 + 8, stageWidth - node.width / 2 - 8);
        node.y = clamp(point.y - activePointer.offsetY, node.height / 2 + 8, stageHeight - node.height / 2 - 8);
        node.vx = 0;
        node.vy = 0;
        solveOverlaps();
        render();
        drawLine();
    }

    function endDrag(event, index) {
        if (!activePointer || activePointer.index !== index) return;
        if (event && activePointer.pointerId !== event.pointerId) return;
        nodes[index].card.classList.remove("is-dragging");
        activePointer = null;
        commitPositions();
        ensureAnimation();
    }

    nodes.forEach(({ card }, index) => {
        card.addEventListener("pointerdown", (event) => startDrag(event, index));
        card.addEventListener("pointermove", (event) => moveDrag(event, index));
        card.addEventListener("pointerup", (event) => endDrag(event, index));
        card.addEventListener("pointercancel", (event) => endDrag(event, index));
        card.addEventListener("lostpointercapture", (event) => endDrag(event, index));
        card.addEventListener("keydown", (event) => {
            const directions = {
                ArrowLeft: [-1, 0],
                ArrowRight: [1, 0],
                ArrowUp: [0, -1],
                ArrowDown: [0, 1]
            };
            const direction = directions[event.key];
            if (!direction) return;
            event.preventDefault();
            const distance = event.shiftKey ? 40 : 20;
            const node = nodes[index];
            node.x = clamp(node.x + direction[0] * distance, node.width / 2 + 8, stageWidth - node.width / 2 - 8);
            node.y = clamp(node.y + direction[1] * distance, node.height / 2 + 8, stageHeight - node.height / 2 - 8);
            solveOverlaps();
            commitPositions();
            ensureAnimation();
        });
    });

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(stage);
    window.addEventListener("resize", updateDimensions);
    updateDimensions();
    frame = window.requestAnimationFrame(animate);
})();
