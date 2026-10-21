const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const themeToggle = document.querySelector(".theme-toggle");
const themeStorageKey = "portfolio-theme";

if (themeToggle instanceof HTMLButtonElement) {
    const isEnglish = document.documentElement.lang === "en";
    try {
        const savedTheme = window.localStorage.getItem(themeStorageKey);
        if (savedTheme === "light" || savedTheme === "dark") {
            document.documentElement.dataset.theme = savedTheme;
        }
    } catch (error) {
        console.warn("Unable to read the saved theme preference:", error);
    }

    const updateThemeToggle = () => {
        const isDark = document.documentElement.dataset.theme === "dark";
        themeToggle.setAttribute("aria-pressed", String(isDark));
        themeToggle.setAttribute("aria-label", isEnglish
            ? (isDark ? "Switch to light theme" : "Switch to dark theme")
            : (isDark ? "Activer le thème clair" : "Activer le thème sombre"));
    };

    updateThemeToggle();
    themeToggle.addEventListener("click", () => {
        const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = nextTheme;
        updateThemeToggle();
        try {
            window.localStorage.setItem(themeStorageKey, nextTheme);
        } catch (error) {
            console.warn("Unable to save the theme preference:", error);
        }
    });
}

const binaryBackground = document.querySelector(".binary-background");

if (binaryBackground instanceof HTMLCanvasElement) {
    const context = binaryBackground.getContext("2d");

    if (context) {
        const cellWidth = 24;
        const cellHeight = 30;
        const glyphs = [];
        const ripples = [];
        let canvasWidth = 0;
        let canvasHeight = 0;
        let animationFrame = 0;
        let lastFrameTime = 0;

        const resizeCanvas = () => {
            if (animationFrame) {
                window.cancelAnimationFrame(animationFrame);
            }
            animationFrame = 0;
            lastFrameTime = 0;

            const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
            canvasWidth = window.innerWidth;
            canvasHeight = window.innerHeight;
            binaryBackground.width = Math.round(canvasWidth * pixelRatio);
            binaryBackground.height = Math.round(canvasHeight * pixelRatio);
            context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
            glyphs.length = 0;

            const columns = Math.ceil(canvasWidth / cellWidth);
            const rows = Math.ceil(canvasHeight / cellHeight);
            for (let row = 0; row <= rows; row += 1) {
                for (let column = 0; column <= columns; column += 1) {
                    glyphs.push({
                        x: column * cellWidth + cellWidth / 2,
                        y: row * cellHeight + cellHeight / 2,
                        value: Math.random() < 0.5 ? "0" : "1"
                    });
                }
            }

            drawFrame();
        };

        const drawFrame = (time = 0) => {
            context.clearRect(0, 0, canvasWidth, canvasHeight);
            context.font = '12px "SFMono-Regular", Consolas, monospace';
            context.textAlign = "center";
            context.textBaseline = "middle";
            const isLightTheme = document.documentElement.dataset.theme === "light";

            for (const glyph of glyphs) {
                let glow = 0;

                for (const ripple of ripples) {
                    const dx = glyph.x - ripple.x;
                    const dy = glyph.y - ripple.y;
                    const distance = Math.hypot(dx, dy);
                    const angle = Math.atan2(dy, dx);
                    const shape = 1
                        + ripple.roughness * Math.sin(angle * ripple.lobes + ripple.phase)
                        + ripple.roughness * 0.45 * Math.sin(angle * (ripple.lobes + 2) - ripple.phase * 1.7);
                    const distanceFromWave = ripple.radius - distance * shape;

                    if (distanceFromWave >= -24 && distanceFromWave <= 180) {
                        const front = Math.exp(-(((distanceFromWave - 1) / 26) ** 2));
                        const trail = distanceFromWave > 0 ? Math.exp(-distanceFromWave / 78) * 0.65 : 0;
                        glow = Math.max(glow, front, trail);
                    }
                }

                if (glow <= 0.02) {
                    continue;
                }

                context.fillStyle = isLightTheme
                    ? `rgba(3, 105, 161, ${0.35 + glow * 0.65})`
                    : `rgba(147, 220, 255, ${0.18 + glow * 0.8})`;
                context.shadowColor = isLightTheme ? "rgba(2, 132, 199, 0.95)" : "rgba(56, 189, 248, 0.9)";
                context.shadowBlur = glow * (isLightTheme ? 13 : 9);
                context.fillText(glyph.value, glyph.x, glyph.y);
            }

            context.shadowBlur = 0;

            if (ripples.length) {
                const elapsed = lastFrameTime ? Math.min(time - lastFrameTime, 40) : 16;
                lastFrameTime = time;

                for (let index = ripples.length - 1; index >= 0; index -= 1) {
                    const ripple = ripples[index];
                    ripple.radius += elapsed * ripple.speed;
                    if (ripple.radius > ripple.maxRadius + 110) {
                        ripples.splice(index, 1);
                    }
                }

                if (ripples.length) {
                    animationFrame = window.requestAnimationFrame(drawFrame);
                } else {
                    animationFrame = 0;
                    lastFrameTime = 0;
                    drawFrame();
                }
            }
        };

        resizeCanvas();
        window.addEventListener("resize", resizeCanvas, { passive: true });

        if (!reducedMotion) {
            document.addEventListener("click", (event) => {
                const maxRadius = Math.hypot(canvasWidth, canvasHeight);
                ripples.push({
                    x: event.clientX,
                    y: event.clientY,
                    radius: 0,
                    maxRadius,
                    speed: 0.72,
                    lobes: 3 + Math.floor(Math.random() * 4),
                    roughness: 0.08 + Math.random() * 0.08,
                    phase: Math.random() * Math.PI * 2
                });

                if (ripples.length > 5) {
                    ripples.shift();
                }
                if (!animationFrame) {
                    animationFrame = window.requestAnimationFrame(drawFrame);
                }
            });
        }
    }
}

if (!reducedMotion && "IntersectionObserver" in window) {
    const revealTargets = document.querySelectorAll(
        ".hero-content, .content-section > .eyebrow, .content-section > h2, .content-section .info-card, .career-copy, .career-section .cta-buttons, .contact-heading, .contact-intro, .contact-form"
    );
    let lastScrollY = window.scrollY;
    let scrollDirection = null;
    const exitedSide = new WeakMap();

    window.addEventListener("scroll", () => {
        const currentScrollY = window.scrollY;
        if (currentScrollY !== lastScrollY) {
            scrollDirection = currentScrollY > lastScrollY ? "down" : "up";
            lastScrollY = currentScrollY;
        }
    }, { passive: true });

    revealTargets.forEach((target) => target.classList.add("reveal-item"));

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            const top = entry.rootBounds?.top ?? 0;
            const bottom = entry.rootBounds?.bottom ?? window.innerHeight;

            if (entry.isIntersecting) {
                const side = exitedSide.get(entry.target);
                if (!side || (scrollDirection === "down" && side === "bottom")
                    || (scrollDirection === "up" && side === "top")) {
                    entry.target.classList.add("is-visible");
                    exitedSide.delete(entry.target);
                }
            } else if (entry.boundingClientRect.bottom <= top) {
                exitedSide.set(entry.target, "top");
                if (scrollDirection === "down") {
                    entry.target.classList.remove("is-visible");
                }
            } else if (entry.boundingClientRect.top >= bottom) {
                exitedSide.set(entry.target, "bottom");
                if (scrollDirection === "up") {
                    entry.target.classList.remove("is-visible");
                }
            }
        });
    }, {
        threshold: 0.12,
        rootMargin: "-6% 0px -6% 0px"
    });

    revealTargets.forEach((target) => revealObserver.observe(target));
}

const navWindow = document.querySelector(".nav-window");
const navLinks = [...document.querySelectorAll(".nav-links a")];
const navSections = navLinks
    .filter((link) => link.getAttribute("href")?.startsWith("#"))
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter((section) => section instanceof HTMLElement);
const header = document.querySelector("header");

if (navWindow && navLinks.length && navSections.length && header) {
    const navToggle = header.querySelector(".nav-toggle");
    const desktopNavigation = window.matchMedia("(min-width: 901px) and (hover: hover) and (pointer: fine)");
    const isEnglish = document.documentElement.lang === "en";
    let activeSection = null;
    let navFrame = 0;
    let pendingSection = null;
    let pendingScrollY = null;
    let lastScrollY = window.scrollY;

    const setMenuOpen = (isOpen) => {
        header.classList.toggle("is-menu-open", isOpen);
        navToggle?.setAttribute("aria-expanded", String(isOpen));
        navToggle?.setAttribute("aria-label", isEnglish
            ? (isOpen ? "Close menu" : "Open menu")
            : (isOpen ? "Fermer le menu" : "Ouvrir le menu"));
    };

    const centerNavLink = (link) => {
        const item = link.closest("li");
        if (!item) {
            return;
        }

        const itemBounds = item.getBoundingClientRect();
        const windowBounds = navWindow.getBoundingClientRect();
        const targetScrollLeft = navWindow.scrollLeft
            + itemBounds.left
            - windowBounds.left
            - (windowBounds.width - itemBounds.width) / 2;

        navWindow.scrollTo({
            left: Math.max(0, targetScrollLeft),
            behavior: reducedMotion ? "instant" : "smooth"
        });
    };

    const setActiveSection = (section) => {
        if (section === activeSection) {
            return;
        }

        activeSection = section;
        const activeLink = navLinks.find((link) => link.getAttribute("href") === `#${section.id}`);
        navLinks.forEach((link) => {
            if (link === activeLink) {
                link.setAttribute("aria-current", "location");
            } else {
                link.removeAttribute("aria-current");
            }
        });

        if (activeLink) {
            centerNavLink(activeLink);
        }
    };

    const updateActiveNav = () => {
        navFrame = 0;
        if (pendingSection && pendingScrollY !== null) {
            const reachedTarget = pendingScrollY >= window.scrollY
                ? window.scrollY >= pendingScrollY - 2
                : window.scrollY <= pendingScrollY + 2;

            if (!reachedTarget) {
                return;
            }

            pendingSection = null;
            pendingScrollY = null;
        }

        const activationLine = 144;
        const atPageEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
        let current = atPageEnd ? navSections[navSections.length - 1] : navSections[0];

        if (!atPageEnd) {
            navSections.forEach((section) => {
                if (section.getBoundingClientRect().top <= activationLine) {
                    current = section;
                }
            });
        }

        setActiveSection(current);
    };

    const scheduleNavUpdate = () => {
        if (!navFrame) {
            navFrame = window.requestAnimationFrame(updateActiveNav);
        }
    };

    window.addEventListener("scroll", scheduleNavUpdate, { passive: true });
    window.addEventListener("scroll", () => {
        const currentScrollY = window.scrollY;
        if (!desktopNavigation.matches) {
            header.classList.remove("is-hidden");
        } else if (currentScrollY < 120 || currentScrollY < lastScrollY - 4) {
            header.classList.remove("is-hidden");
        } else if (currentScrollY > lastScrollY + 4) {
            header.classList.add("is-hidden");
        }
        lastScrollY = currentScrollY;
    }, { passive: true });

    navToggle?.addEventListener("click", () => {
        setMenuOpen(!header.classList.contains("is-menu-open"));
    });

    document.addEventListener("click", (event) => {
        if (header.classList.contains("is-menu-open") && event.target instanceof Node && !header.contains(event.target)) {
            setMenuOpen(false);
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && header.classList.contains("is-menu-open")) {
            setMenuOpen(false);
            navToggle?.focus();
        }
    });

    window.addEventListener("pointermove", (event) => {
        if (desktopNavigation.matches) {
            if (event.clientY <= header.offsetHeight + 12) {
                header.classList.remove("is-hidden");
            } else if (window.scrollY > 120) {
                header.classList.add("is-hidden");
            }
        }
    }, { passive: true });

    window.addEventListener("resize", () => {
        if (desktopNavigation.matches) {
            setMenuOpen(false);
            header.classList.remove("is-hidden");
        }
        activeSection = null;
        scheduleNavUpdate();
    });
    navLinks.forEach((link) => {
        link.addEventListener("focus", () => centerNavLink(link));
        link.addEventListener("click", (event) => {
            const href = link.getAttribute("href");
            const section = href?.startsWith("#") ? document.querySelector(href) : null;
            if (section instanceof HTMLElement) {
                event.preventDefault();
                pendingSection = section;
                const sectionTop = section.getBoundingClientRect().top + window.scrollY;
                const scrollMargin = Number.parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
                const maxScrollY = document.documentElement.scrollHeight - window.innerHeight;
                pendingScrollY = Math.min(Math.max(0, sectionTop - scrollMargin), maxScrollY);
                setActiveSection(section);
                if (window.location.hash !== `#${section.id}`) {
                    history.pushState(null, "", `#${section.id}`);
                }
                section.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "start" });
                scheduleNavUpdate();
                setMenuOpen(false);
            }
        });
    });

    window.addEventListener("popstate", () => {
        const target = navSections.find((section) => `#${section.id}` === window.location.hash);
        if (target) {
            pendingSection = target;
            const sectionTop = target.getBoundingClientRect().top + window.scrollY;
            const scrollMargin = Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
            pendingScrollY = Math.min(
                Math.max(0, sectionTop - scrollMargin),
                document.documentElement.scrollHeight - window.innerHeight
            );
            setActiveSection(target);
            target.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "start" });
        } else {
            pendingSection = null;
            pendingScrollY = null;
            scheduleNavUpdate();
        }
    });

    scheduleNavUpdate();
}

document.addEventListener("contextmenu", (event) => {
    if (event.target instanceof HTMLImageElement) {
        event.preventDefault();
    }
});

document.addEventListener("dragstart", (event) => {
    if (event.target instanceof HTMLImageElement) {
        event.preventDefault();
    }
});

const contactForm = document.querySelector("#contact-form");
const contactFormNote = document.querySelector("#contact-form-note");

if (contactForm instanceof HTMLFormElement && contactFormNote instanceof HTMLElement) {
    contactForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const isEnglish = document.documentElement.lang === "en";
        const formData = new FormData(contactForm);
        const name = String(formData.get("name") ?? "").trim();
        const email = String(formData.get("email") ?? "").trim();
        const subject = String(formData.get("subject") ?? "").trim();
        const message = String(formData.get("message") ?? "").trim();
        if (!name || !email || !subject || !message) {
            contactFormNote.textContent = isEnglish
                ? "Please complete every field before preparing your message."
                : "Merci de remplir tous les champs avant de préparer le message.";
            return;
        }

        const greeting = isEnglish ? "Hello Thomas," : "Bonjour Thomas,";
        const body = `${greeting}\n\n${message}\n\n— ${name}\n${email}`;
        const mailto = `mailto:thomas.mauline@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        contactFormNote.textContent = isEnglish
            ? "Your email app will open with your message ready to send."
            : "Ton application e-mail va s’ouvrir avec ton message prêt à être envoyé.";
        window.location.href = mailto;
    });
}

const cursorEffects = document.querySelector(".cursor-effects");
const supportsCustomCursor = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

if (cursorEffects && supportsCustomCursor && !reducedMotion) {
    const solarSystem = cursorEffects.querySelector(".cursor-solar");
    const cometTails = [...cursorEffects.querySelectorAll(".comet-tail")];
    const orbits = [...cursorEffects.querySelectorAll(".solar-orbit")];
    const targetFrame = cursorEffects.querySelector(".cursor-target-frame");
    const randomizeOrbitSystem = () => {
        orbits.forEach((orbit) => {
            const planet = orbit.querySelector(".solar-planet");
            const size = 3 + Math.random() * 4;
            const corners = Array.from({ length: 4 }, () => 25 + Math.random() * 50);

            orbit.style.setProperty("--orbit-angle", `${Math.round(Math.random() * 360)}deg`);
            planet.style.setProperty("--planet-size", `${size.toFixed(1)}px`);
            planet.style.setProperty("--planet-shape", `${corners.join("% ")}%`);
        });
    };

    randomizeOrbitSystem();
    const pointer = { x: 0, y: 0 };
    const followers = [
        { x: 0, y: 0, speed: 0.34 },
        { x: 0, y: 0, speed: 0.2 },
        { x: 0, y: 0, speed: 0.11 }
    ];
    let pointerActive = false;
    let animationFrame = 0;
    let idleTimeout = 0;
    let solarX = 0;
    let solarY = 0;
    let currentTarget = null;

    const positionTargetFrame = () => {
        if (!currentTarget) {
            return;
        }

        const bounds = currentTarget.getBoundingClientRect();
        targetFrame.style.width = `${bounds.width + 10}px`;
        targetFrame.style.height = `${bounds.height + 10}px`;
        targetFrame.style.transform = `translate3d(${bounds.left - 5}px, ${bounds.top - 5}px, 0)`;
    };

    const renderCursor = function renderCursor() {
        solarX += (pointer.x - solarX) * 0.32;
        solarY += (pointer.y - solarY) * 0.32;
        solarSystem.style.transform = `translate3d(${solarX - 29}px, ${solarY - 29}px, 0)`;

        followers.forEach((follower, index) => {
            follower.x += (pointer.x - follower.x) * follower.speed;
            follower.y += (pointer.y - follower.y) * follower.speed;
            cometTails[index].style.transform = `translate3d(${follower.x - 2}px, ${follower.y - 2}px, 0)`;
        });

        const stillFollowing = Math.abs(pointer.x - solarX) > 0.25
            || Math.abs(pointer.y - solarY) > 0.25
            || followers.some((follower) => Math.abs(pointer.x - follower.x) > 0.25
                || Math.abs(pointer.y - follower.y) > 0.25);

        if (pointerActive && stillFollowing) {
            animationFrame = window.requestAnimationFrame(renderCursor);
        } else {
            animationFrame = 0;
        }
    };

    document.addEventListener("pointermove", (event) => {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        const target = event.target instanceof Element
            ? event.target.closest("a, button, input, select, textarea, [role='button']")
            : null;

        if (!pointerActive) {
            pointerActive = true;
            solarX = pointer.x;
            solarY = pointer.y;
            followers.forEach((follower) => {
                follower.x = pointer.x;
                follower.y = pointer.y;
            });
            cursorEffects.classList.add("is-visible");
        }

        if (target instanceof HTMLElement) {
            currentTarget = target;
            positionTargetFrame();
            cursorEffects.classList.add("is-targeted");
            cursorEffects.classList.remove("is-moving", "is-idle");
            window.clearTimeout(idleTimeout);
            if (!animationFrame) {
                animationFrame = window.requestAnimationFrame(renderCursor);
            }
            return;
        }

        currentTarget = null;
        cursorEffects.classList.remove("is-targeted");
        cursorEffects.classList.remove("is-idle");
        cursorEffects.classList.add("is-moving");
        window.clearTimeout(idleTimeout);
        idleTimeout = window.setTimeout(() => {
            cursorEffects.classList.remove("is-moving");
            randomizeOrbitSystem();
            cursorEffects.classList.add("is-idle");
        }, 180);

        if (!animationFrame) {
            animationFrame = window.requestAnimationFrame(renderCursor);
        }
    });

    document.addEventListener("scroll", positionTargetFrame, { passive: true });
    window.addEventListener("resize", positionTargetFrame);

    document.addEventListener("pointerleave", () => {
        pointerActive = false;
        currentTarget = null;
        window.clearTimeout(idleTimeout);
        cursorEffects.classList.remove("is-visible", "is-moving", "is-idle", "is-targeted");
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
    });
}
