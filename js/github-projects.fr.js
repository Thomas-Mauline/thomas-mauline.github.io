const projectSection = document.querySelector("[data-github-projects]");

if (projectSection instanceof HTMLElement) {
    const githubUser = projectSection.dataset.githubUser;
    const carousel = projectSection.querySelector("[data-project-carousel]");
    const track = projectSection.querySelector("[data-project-track]");
    const scrollbar = projectSection.querySelector("[data-project-scrollbar]");
    const scrollbarThumb = projectSection.querySelector("[data-project-scrollbar-thumb]");
    const status = projectSection.querySelector("[data-project-status]");
    const retryButton = projectSection.querySelector("[data-project-retry]");
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (
        githubUser
        && carousel instanceof HTMLElement
        && track instanceof HTMLElement
        && scrollbar instanceof HTMLElement
        && scrollbarThumb instanceof HTMLElement
        && status instanceof HTMLElement
        && retryButton instanceof HTMLButtonElement
    ) {
        const githubHeaders = { Accept: "application/vnd.github+json" };
        const resumeDelay = 5_000;
        const speed = 24;
        const endpointPause = 1_200;
        let animationFrame = 0;
        let previousFrameTime = 0;
        let position = 0;
        let direction = 1;
        let pauseUntil = 0;
        let resumeAt = 0;
        let resumeTimeout = 0;
        let drag = null;
        let suppressClick = false;

        const getReadme = async (repository) => {
            const response = await fetch(
                `https://api.github.com/repos/${repository.full_name}/readme`,
                { headers: { Accept: "application/vnd.github.raw+json" } }
            );
            if (!response.ok) {
                throw new Error(`README indisponible (${response.status})`);
            }
            return response.text();
        };

        const getSocialPreview = async (repository) => {
            const metadataUrl = `https://r.jina.ai/http://github.com/${repository.full_name}`;
            const response = await fetch(metadataUrl, {
                headers: { "X-Return-Format": "html" }
            });
            if (!response.ok) {
                throw new Error(`Aperçu social indisponible (${response.status})`);
            }

            const page = new DOMParser().parseFromString(await response.text(), "text/html");
            const image = page.querySelector('meta[property="og:image"]')?.content;
            if (!image) {
                return null;
            }

            const imageUrl = new URL(image);
            if (
                imageUrl.protocol !== "https:"
                || !["repository-images.githubusercontent.com", "opengraph.githubassets.com"].includes(imageUrl.hostname)
            ) {
                return null;
            }
            return imageUrl.href;
        };

        const getExcerpt = (markdown) => {
            const excerpt = markdown
                .replace(/^\uFEFF/, "")
                .replace(/^---\s*\n[\s\S]*?\n---\s*(?:\n|$)/, "")
                .replace(/```[\s\S]*?```/g, " ")
                .replace(/<[^>]*>/g, " ")
                .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
                .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
                .replace(/^\s{0,3}#{1,6}\s*/gm, "")
                .replace(/^\s*>\s?/gm, "")
                .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, "")
                .replace(/[`*_~]/g, "")
                .replace(/\s+/g, " ")
                .trim();

            if (excerpt.length <= 280) {
                return excerpt;
            }
            const truncated = excerpt.slice(0, 280);
            return `${truncated.slice(0, truncated.lastIndexOf(" "))}…`;
        };

        const createCard = (repository, readme, socialPreview) => {
            const card = document.createElement("article");
            card.className = "github-project-card";
            card.setAttribute("aria-label", repository.name);

            const image = document.createElement("img");
            image.className = "github-project-image";
            image.alt = `Aperçu social du projet ${repository.name}`;
            image.loading = "lazy";
            const fallbackPreview = `https://opengraph.githubassets.com/1/${repository.full_name}`;
            image.addEventListener("error", () => {
                if (image.src !== fallbackPreview) {
                    image.src = fallbackPreview;
                } else if (repository.owner?.avatar_url && image.src !== repository.owner.avatar_url) {
                    image.src = repository.owner.avatar_url;
                } else {
                    image.remove();
                }
            });
            image.src = socialPreview || fallbackPreview;

            const copy = document.createElement("div");
            copy.className = "github-project-copy";

            const title = document.createElement("h4");
            const titleLink = document.createElement("a");
            titleLink.href = repository.html_url;
            titleLink.target = "_blank";
            titleLink.rel = "noreferrer";
            titleLink.textContent = repository.name;
            title.append(titleLink);

            const date = document.createElement("p");
            date.className = "github-project-date";
            date.textContent = `Mis à jour le ${new Date(repository.updated_at).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric"
            })}`;

            const excerpt = document.createElement("p");
            excerpt.className = "github-project-excerpt";
            excerpt.textContent = readme
                ? getExcerpt(readme) || repository.description || "Aucune description disponible."
                : repository.description || "Aucun aperçu README disponible.";

            copy.append(title, date, excerpt);
            card.append(image, copy);
            return card;
        };

        const fetchRepositoryDetails = async (repository) => {
            const [readmeResult, previewResult] = await Promise.allSettled([
                getReadme(repository),
                getSocialPreview(repository)
            ]);

            return {
                repository,
                readme: readmeResult.status === "fulfilled" ? readmeResult.value : "",
                preview: previewResult.status === "fulfilled" ? previewResult.value : null,
                readmeUnavailable: readmeResult.status === "rejected"
            };
        };

        const setPosition = (nextPosition) => {
            const maxScroll = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
            position = Math.max(0, Math.min(nextPosition, maxScroll));
            track.style.transform = `translate3d(${-position}px, 0, 0)`;

            const thumbWidth = scrollbar.clientWidth * carousel.clientWidth / Math.max(track.scrollWidth, carousel.clientWidth);
            const maxThumbPosition = Math.max(0, scrollbar.clientWidth - thumbWidth);
            const thumbPosition = maxScroll ? maxThumbPosition * position / maxScroll : 0;
            scrollbarThumb.style.width = `${thumbWidth}px`;
            scrollbarThumb.style.transform = `translate3d(${thumbPosition}px, -50%, 0)`;
            scrollbar.setAttribute("aria-valuemax", String(Math.round(maxScroll)));
            scrollbar.setAttribute("aria-valuenow", String(Math.round(position)));
        };

        const updateStatus = () => {
            const maxScroll = carousel.scrollWidth - carousel.clientWidth;
            setPosition(position);
            if (maxScroll <= 1 || motionPreference.matches) {
                return;
            }
            if (direction > 0 && position >= maxScroll) {
                direction = -1;
                pauseUntil = Date.now() + endpointPause;
                previousFrameTime = 0;
            } else if (direction < 0 && position <= 0) {
                direction = 1;
                pauseUntil = Date.now() + endpointPause;
                previousFrameTime = 0;
            }
        };

        const animate = (time) => {
            animationFrame = 0;
            const maxScroll = carousel.scrollWidth - carousel.clientWidth;
            if (
                motionPreference.matches
                || document.visibilityState !== "visible"
                || maxScroll <= 1
                || projectSection.contains(document.activeElement)
                || drag
            ) {
                previousFrameTime = 0;
                return;
            }

            if (Date.now() < pauseUntil) {
                previousFrameTime = 0;
                animationFrame = window.requestAnimationFrame(animate);
                return;
            }

            const elapsed = previousFrameTime ? Math.min(time - previousFrameTime, 40) : 0;
            previousFrameTime = time;
            setPosition(position + direction * speed * elapsed / 1000);
            updateStatus();
            animationFrame = window.requestAnimationFrame(animate);
        };

        const startAnimation = () => {
            if (
                motionPreference.matches
                || document.visibilityState !== "visible"
                || carousel.scrollWidth - carousel.clientWidth <= 1
                || projectSection.contains(document.activeElement)
                || drag
            ) {
                return;
            }
            if (Date.now() < resumeAt) {
                if (!resumeTimeout) {
                    resumeTimeout = window.setTimeout(() => {
                        resumeTimeout = 0;
                        startAnimation();
                    }, resumeAt - Date.now());
                }
                return;
            }
            if (!animationFrame) {
                animationFrame = window.requestAnimationFrame(animate);
            }
        };

        const loadProjects = async () => {
            retryButton.hidden = true;
            status.textContent = "Chargement des projets GitHub…";
            track.replaceChildren();

            try {
                const repositories = [];
                let page = 1;
                let pageRepositories;
                do {
                    const response = await fetch(
                        `https://api.github.com/users/${encodeURIComponent(githubUser)}/repos?per_page=100&sort=updated&page=${page}`,
                        { headers: githubHeaders, cache: "no-store" }
                    );
                    if (!response.ok) {
                        throw new Error(`GitHub a répondu ${response.status}`);
                    }
                    pageRepositories = await response.json();
                    if (!Array.isArray(pageRepositories)) {
                        throw new Error("La réponse de GitHub n’a pas le format attendu.");
                    }
                    repositories.push(...pageRepositories);
                    page += 1;
                } while (pageRepositories.length === 100);

                repositories.sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at));
                const details = await Promise.all(repositories.map(fetchRepositoryDetails));
                for (const item of details) {
                    track.append(createCard(item.repository, item.readme, item.preview));
                }

                if (!details.length) {
                    status.textContent = "Aucun dépôt public n’a été trouvé pour ce profil.";
                    return;
                }

                const unavailableReadmes = details.filter((item) => item.readmeUnavailable).length;
                status.textContent = unavailableReadmes
                    ? `${details.length} projets chargés. Le README de ${unavailableReadmes} dépôt${unavailableReadmes > 1 ? "s" : ""} n’a pas pu être récupéré.`
                    : `${details.length} projets chargés depuis le profil GitHub WebyPanda.`;
                updateStatus();
                startAnimation();
            } catch (error) {
                console.error("Impossible de charger les projets GitHub :", error);
                status.textContent = "Impossible de charger les projets GitHub. Vérifie ta connexion puis réessaie.";
                retryButton.hidden = false;
            }
        };

        carousel.addEventListener("pointerdown", (event) => {
            if (event.button !== 0 || event.target instanceof Element && event.target.closest("a")) {
                return;
            }
            drag = {
                pointerId: event.pointerId,
                startX: event.clientX,
                lastX: event.clientX,
                startPosition: position,
                source: "carousel"
            };
        });

        scrollbar.addEventListener("pointerdown", (event) => {
            if (event.button !== 0) {
                return;
            }
            event.preventDefault();
            const isThumb = event.target === scrollbarThumb;
            if (!isThumb) {
                const maxScroll = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
                const maxThumbPosition = Math.max(0, scrollbar.clientWidth - scrollbarThumb.clientWidth);
                const clickPosition = event.clientX - scrollbar.getBoundingClientRect().left;
                setPosition(maxThumbPosition
                    ? (clickPosition - scrollbarThumb.clientWidth / 2) / maxThumbPosition * maxScroll
                    : 0);
            }
            const thumbBounds = scrollbarThumb.getBoundingClientRect();
            drag = {
                pointerId: event.pointerId,
                startX: event.clientX,
                lastX: event.clientX,
                startPosition: position,
                startThumbPosition: thumbBounds.left - scrollbar.getBoundingClientRect().left,
                source: "scrollbar"
            };
        });

        const moveDrag = (event) => {
            if (!drag || event.pointerId !== drag.pointerId) {
                return;
            }
            const delta = event.clientX - drag.lastX;
            if (Math.abs(event.clientX - drag.startX) > 4) {
                suppressClick = true;
                event.preventDefault();
            }
            if (suppressClick) {
                if (drag.source === "scrollbar") {
                    const maxScroll = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
                    const maxThumbPosition = Math.max(0, scrollbar.clientWidth - scrollbarThumb.clientWidth);
                    const thumbPosition = drag.startThumbPosition + event.clientX - drag.startX;
                    setPosition(maxThumbPosition ? thumbPosition / maxThumbPosition * maxScroll : 0);
                } else {
                    setPosition(drag.startPosition - (event.clientX - drag.startX));
                }
                drag.lastX = event.clientX;
                direction = delta > 0 ? -1 : 1;
                resumeAt = Date.now() + resumeDelay;
            }
        };

        const endDrag = (event) => {
            if (!drag || event.pointerId !== drag.pointerId) {
                return;
            }
            drag = null;
            window.setTimeout(() => {
                suppressClick = false;
            }, 100);
            startAnimation();
        };

        document.addEventListener("pointermove", moveDrag, { capture: true, passive: false });
        window.addEventListener("pointerup", endDrag);
        window.addEventListener("pointercancel", endDrag);
        scrollbar.addEventListener("keydown", (event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") {
                return;
            }
            event.preventDefault();
            if (event.key === "Home") {
                setPosition(0);
                direction = -1;
            } else if (event.key === "End") {
                setPosition(carousel.scrollWidth - carousel.clientWidth);
                direction = 1;
            } else {
                const delta = event.key === "ArrowRight" ? 40 : -40;
                setPosition(position + delta);
                direction = delta > 0 ? 1 : -1;
            }
            resumeAt = Date.now() + resumeDelay;
        });
        carousel.addEventListener("click", (event) => {
            if (suppressClick) {
                event.preventDefault();
                event.stopPropagation();
            }
        }, true);
        carousel.addEventListener("wheel", (event) => {
            const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
                ? event.deltaX
                : event.shiftKey ? event.deltaY : 0;
            if (delta === 0) {
                return;
            }
            event.preventDefault();
            setPosition(position + delta);
            direction = delta > 0 ? 1 : -1;
            resumeAt = Date.now() + resumeDelay;
            startAnimation();
        }, { passive: false });
        scrollbar.addEventListener("wheel", (event) => {
            const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
                ? event.deltaX
                : event.shiftKey ? event.deltaY : 0;
            if (delta === 0) {
                return;
            }
            event.preventDefault();
            setPosition(position + delta);
            direction = delta > 0 ? 1 : -1;
            resumeAt = Date.now() + resumeDelay;
            startAnimation();
        }, { passive: false });
        projectSection.addEventListener("focusin", () => {
            if (animationFrame) {
                window.cancelAnimationFrame(animationFrame);
                animationFrame = 0;
            }
            previousFrameTime = 0;
        });
        projectSection.addEventListener("focusout", () => {
            window.setTimeout(startAnimation, 0);
        });
        window.addEventListener("resize", () => {
            updateStatus();
            startAnimation();
        }, { passive: true });
        document.addEventListener("visibilitychange", () => {
            previousFrameTime = 0;
            if (document.visibilityState === "visible") {
                startAnimation();
            } else if (animationFrame) {
                window.cancelAnimationFrame(animationFrame);
                animationFrame = 0;
            }
        });
        motionPreference.addEventListener("change", () => {
            previousFrameTime = 0;
            if (motionPreference.matches && animationFrame) {
                window.cancelAnimationFrame(animationFrame);
                animationFrame = 0;
            } else {
                startAnimation();
            }
        });
        retryButton.addEventListener("click", loadProjects);

        loadProjects();
    }
}
