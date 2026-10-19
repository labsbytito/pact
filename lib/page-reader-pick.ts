export function pickPageElement(blocked: (element: Element) => boolean) {
  return new Promise<Element>((resolve, reject) => {
        const overlay = document.createElement("div");
        overlay.dataset.pactPicker = "true";
        overlay.style.cssText =
          "position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #dc735d;background:#dc735d12;border-radius:5px;display:none;";
        const hint = document.createElement("div");
        hint.dataset.pactPicker = "true";
        hint.textContent = "Pact · Click an item to share it · Esc to cancel";
        hint.style.cssText =
          "position:fixed;z-index:2147483647;top:12px;left:50%;transform:translateX(-50%);pointer-events:none;background:#292a2e;color:white;padding:10px 16px;border-radius:9px;font:14px system-ui;max-width:90vw;text-align:center;";
        document.documentElement.append(overlay, hint);
        let target: Element | undefined;
        const choose = (event: MouseEvent) => {
          const hit = event
            .composedPath()
            .find((node) => node instanceof Element && !blocked(node)) as
            Element | undefined;
          if (
            !hit ||
            hit === document.documentElement ||
            hit === document.body ||
            blocked(event.target as Element)
          ) {
            target = undefined;
            overlay.style.display = "none";
            return;
          }
          target =
            hit.closest(
              'shreddit-post,article,[role="article"],[data-testid="post-container"],figure,li,p,h1,h2,h3,h4,a',
            ) ?? hit;
          const rect = target.getBoundingClientRect();
          Object.assign(overlay.style, {
            display: "block",
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
          });
        };
        const cleanup = () => {
          overlay.remove();
          hint.remove();
          window.removeEventListener("mousemove", choose, true);
          window.removeEventListener("click", click, true);
          for (const type of [
            "pointerdown",
            "pointerup",
            "mousedown",
            "mouseup",
          ] as const)
            window.removeEventListener(type, blockActivation, true);
          window.removeEventListener("keydown", key, true);
          clearTimeout(timer);
        };
        const blockActivation = (event: MouseEvent) => {
          choose(event);
          if (target) {
            event.preventDefault();
            event.stopImmediatePropagation();
          }
        };
        const click = (event: MouseEvent) => {
          choose(event);
          if (!target) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          const selected = target;
          cleanup();
          resolve(selected);
        };
        const key = (event: KeyboardEvent) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopImmediatePropagation();
            cleanup();
            reject(new Error("Selection cancelled."));
          }
        };
        const timer = setTimeout(() => {
          cleanup();
          reject(
            new Error("Selection timed out. Choose Select item to try again."),
          );
        }, 45000);
        window.addEventListener("mousemove", choose, true);
        window.addEventListener("click", click, true);
        for (const type of [
          "pointerdown",
          "pointerup",
          "mousedown",
          "mouseup",
        ] as const)
          window.addEventListener(type, blockActivation, true);
        window.addEventListener("keydown", key, true);
  });
}
