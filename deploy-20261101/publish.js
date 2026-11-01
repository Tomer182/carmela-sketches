// Carmela 1.11.2026 live deploy. Runs inside a logged-in wp-admin tab (Tomer's own session).
// Steps are idempotent and keep state in localStorage.carmelaDeploy.
// CD.step('backup') -> draft copies of the 6 live pages; CD.step('media') -> upload assets;
// CD.step('publish') -> write pages; CD.step('purge') -> clear caches; CD.step('restore') -> put the backup back.
window.CD = (() => {
  const BASE = 'https://tomer182.github.io/carmela-sketches/deploy-20261101/';
  const S = JSON.parse(localStorage.carmelaDeploy || '{}');
  const save = () => (localStorage.carmelaDeploy = JSON.stringify(S));
  const rest = async () => S.rest || (S.rest = await (await fetch('/wp-admin/admin-ajax.php?action=rest-nonce', { credentials: 'include' })).text());
  const api = async (path, opt = {}) => {
    const r = await fetch('/wp-json/wp/v2/' + path, { credentials: 'include', ...opt, headers: { 'X-WP-Nonce': await rest(), ...(opt.json ? { 'Content-Type': 'application/json' } : {}), ...(opt.headers || {}) }, body: opt.json ? JSON.stringify(opt.json) : opt.body });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(path + ' ' + r.status + ' ' + (j.message || ''));
    return j;
  };
  const elNonce = async (pid) => {
    const h = await (await fetch('/wp-admin/post.php?post=' + pid + '&action=elementor', { credentials: 'include' })).text();
    const m = h.match(/"ajax":\{[^}]*?"nonce":"([a-z0-9]+)"/i) || h.match(/"nonce":"([a-z0-9]{10})"/i);
    if (!m) throw new Error('no elementor nonce ' + pid);
    return m[1];
  };
  const saveBuilder = async (pid, elements, status) => {
    const n = await elNonce(pid);
    const fd = new URLSearchParams({ action: 'elementor_ajax', _nonce: n, editor_post_id: String(pid), actions: JSON.stringify({ save_builder: { action: 'save_builder', data: { status, elements } } }) });
    const r = await (await fetch('/wp-admin/admin-ajax.php', { method: 'POST', credentials: 'include', body: fd })).json();
    const inner = Object.values((r.data || {}).responses || {});
    if (!r.success || inner.some(x => x && x.success === false)) throw new Error('elementor save ' + pid + ' ' + JSON.stringify(r).slice(0, 300));
    return true;
  };
  const manifest = async () => S.manifest || (S.manifest = await (await fetch(BASE + 'manifest.json?' + Date.now())).json());

  async function backup() {
    const m = await manifest(); S.backup = S.backup || {};
    for (const p of m.pages) {
      if (S.backup[p.id]) continue;
      const cur = await api('pages/' + p.id + '?context=edit');
      const raw = cur.meta && cur.meta._elementor_data;
      const copy = await api('pages', { method: 'POST', json: { title: 'גיבוי 1.11.2026 · ' + cur.title.raw, status: 'draft', template: cur.template || '', content: cur.content.raw, meta: { _elementor_edit_mode: 'builder', _elementor_template_type: 'wp-page' } } });
      if (raw) await saveBuilder(copy.id, typeof raw === 'string' ? JSON.parse(raw) : raw, 'draft');
      S.backup[p.id] = { copy: copy.id, title: cur.title.raw, template: cur.template, modified_gmt: cur.modified_gmt, dataLen: raw ? raw.length : 0 };
      save();
    }
    return S.backup;
  }

  async function media() {
    const m = await manifest(); S.media = S.media || {};
    for (const [name, url] of Object.entries(m.assets)) {
      if (S.media[name]) continue;
      const blob = await (await fetch(url)).blob();
      const fname = 'carmela-2611-' + name;
      const j = await api('media', { method: 'POST', body: blob, headers: { 'Content-Disposition': 'attachment; filename="' + fname + '"', 'Content-Type': blob.type || 'application/octet-stream' } });
      S.media[name] = j.source_url; save();
    }
    return Object.keys(S.media).length + '/' + Object.keys(m.assets).length;
  }

  async function publish() {
    const m = await manifest(); S.published = S.published || {};
    if (!S.backup || Object.keys(S.backup).length !== m.pages.length) throw new Error('backup first');
    for (const p of m.pages) {
      if (S.published[p.id]) continue;
      let txt = await (await fetch(BASE + p.slug + '.json?' + Date.now())).text();
      txt = txt.replace(/@@A:([^@]+)@@/g, (_, a) => { if (!S.media[a]) throw new Error('missing media ' + a); return S.media[a]; });
      const elements = JSON.parse(txt);
      await api('pages/' + p.id, { method: 'POST', json: { title: p.title, status: 'publish', template: p.template, meta: { _elementor_edit_mode: 'builder', _elementor_data: JSON.stringify(elements) } } });
      await saveBuilder(p.id, elements, 'publish');
      S.published[p.id] = new Date().toISOString(); save();
    }
    return S.published;
  }

  async function purge() {
    const out = {};
    try {
      const h = await (await fetch('/wp-admin/admin.php?page=elementor-tools', { credentials: 'include' })).text();
      const n = (h.match(/"elementor_clear_cache"[^}]*?"nonce":"([a-z0-9]+)"/i) || h.match(/elementor_clear_cache[^"]*"[^"]*_nonce=([a-z0-9]+)/i) || [])[1];
      const n2 = n || (h.match(/"nonce":"([a-z0-9]{10})"/) || [])[1];
      const r = await fetch('/wp-admin/admin-ajax.php', { method: 'POST', credentials: 'include', body: new URLSearchParams({ action: 'elementor_clear_cache', _nonce: n2 }) });
      out.elementor = r.status;
    } catch (e) { out.elementor = String(e); }
    try {
      const h = await (await fetch('/wp-admin/', { credentials: 'include' })).text();
      const u = [...h.matchAll(/href=["']([^"']*purge_all[^"']*)["']/g)].map(x => x[1].replace(/&amp;/g, '&'))[0];
      if (u) { out.litespeed = (await fetch(u, { credentials: 'include' })).status; } else out.litespeed = 'no link';
    } catch (e) { out.litespeed = String(e); }
    return out;
  }

  async function restore() {
    const out = {};
    for (const [pid, b] of Object.entries(S.backup || {})) {
      const copy = await api('pages/' + b.copy + '?context=edit');
      const raw = copy.meta && copy.meta._elementor_data;
      await api('pages/' + pid, { method: 'POST', json: { title: b.title, template: b.template || '', meta: { _elementor_edit_mode: 'builder', _elementor_data: raw } } });
      if (raw) await saveBuilder(+pid, typeof raw === 'string' ? JSON.parse(raw) : raw, 'publish');
      out[pid] = 'restored';
    }
    return out;
  }

  const steps = { backup, media, publish, purge, restore };
  return { S, step: async (k) => { try { return await steps[k](); } catch (e) { return 'ERROR ' + e.message; } }, reset: () => { localStorage.removeItem('carmelaDeploy'); } };
})();
