// Loads a scene module (scenes/<name>.js, default export {mount(el, ctx)}) and mounts it. Never throws: a missing or
// broken scene leaves the illustration zone empty instead of breaking the app.
const noop = { update() {}, destroy() {} };
export async function mountScene(name, el, ctx) {
  try {
    const mod = await import(`./${name}.js`);
    const inst = await mod.default.mount(el, ctx);
    return { update: s => { try { inst && inst.update && inst.update(s); } catch (e) { console.warn('[scene]', name, e); } },
             destroy: () => { try { inst && inst.destroy && inst.destroy(); } catch (e) { console.warn('[scene]', name, e); } } };
  } catch (e) {
    console.warn('[scene] could not load', name, e);
    return noop;
  }
}
