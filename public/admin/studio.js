;(function () {
  var root = document.getElementById('nc-root')
  var shell = document.getElementById('studio-shell')
  var locationLabel = document.getElementById('studio-location')
  var searchInput = document.getElementById('studio-search')
  var primaryAction = document.getElementById('studio-primary-action')
  var mediaButton = document.getElementById('studio-media')
  var activeSection = null

  var sectionMeta = {
    projects: { label: 'Projects', search: 'Search projects', action: 'New project', href: '#/collections/projects/new' },
    blog: { label: 'Build notes', search: 'Search build notes', action: 'New build note', href: '#/collections/blog/new' },
    experience: { label: 'Experience', search: 'Search experience', action: 'New role', href: '#/collections/experience/new' },
    profile: { label: 'Profile' },
    links: { label: 'Contact links' },
    resume: { label: 'Résumé' },
  }

  function currentSection() {
    var hash = window.location.hash || '#/'
    if (hash.indexOf('/collections/blog') !== -1) return 'blog'
    if (hash.indexOf('/collections/experience') !== -1) return 'experience'
    if (hash.indexOf('/collections/profile') !== -1) return 'profile'
    if (hash.indexOf('/collections/links') !== -1) return 'links'
    if (hash.indexOf('/collections/resume') !== -1) return 'resume'
    return 'projects'
  }

  function isCollectionList(section) {
    var hash = window.location.hash || '#/'
    return hash === '#/collections/' + section || hash === '#/collections/' + section + '/'
  }

  function syncRoute() {
    var section = currentSection()
    var meta = sectionMeta[section]
    var listView = isCollectionList(section)
    var hash = window.location.hash || '#/'
    var routeChanged = activeSection !== section
    activeSection = section

    document.body.classList.toggle('studio-list-view', listView)
    document.body.classList.toggle('studio-entry-view', !listView)
    document.body.classList.toggle('studio-searchable', Boolean(meta.search && listView))

    if (hash.indexOf('/new') !== -1) locationLabel.textContent = meta.label + ' / New'
    else if (hash.indexOf('/entries/') !== -1) locationLabel.textContent = meta.label + ' / Edit'
    else locationLabel.textContent = meta.label
    searchInput.placeholder = meta.search || 'Search content'
    if (routeChanged || !listView) searchInput.value = ''

    primaryAction.hidden = !meta.action || !listView
    if (meta.action && listView) {
      primaryAction.href = meta.href
      primaryAction.querySelector('span').textContent = meta.action
    }

    document.querySelectorAll('[data-studio-route]').forEach(function (link) {
      var active = link.getAttribute('data-studio-route') === section
      link.classList.toggle('is-active', active)
      if (active) link.setAttribute('aria-current', 'page')
      else link.removeAttribute('aria-current')
    })

    filterCollection(searchInput.value)
  }

  function syncAuthentication() {
    var authenticated = Boolean(
      root.querySelector('a[href^="#/collections/"]') ||
      (root.querySelector(':scope > header') && root.querySelector('aside'))
    )
    document.body.classList.toggle('studio-authenticated', authenticated)
    shell.setAttribute('aria-hidden', authenticated ? 'false' : 'true')
    if (authenticated) syncRoute()
  }

  function filterCollection(value) {
    if (!document.body.classList.contains('studio-list-view')) return
    var query = String(value || '').trim().toLocaleLowerCase()
    root.querySelectorAll('main ul li').forEach(function (item) {
      item.hidden = Boolean(query) && item.textContent.toLocaleLowerCase().indexOf(query) === -1
    })
  }

  searchInput.addEventListener('input', function (event) {
    filterCollection(event.target.value)
  })

  mediaButton.addEventListener('click', function () {
    var nativeMedia = Array.from(root.querySelectorAll('button')).find(function (button) {
      return button.textContent.trim() === 'Media'
    })
    if (nativeMedia) nativeMedia.click()
  })

  // Decap can briefly reuse stale form state when moving directly between
  // single-file collections. A full reload keeps each focused editor isolated.
  document.querySelectorAll('[data-studio-route="profile"], [data-studio-route="links"], [data-studio-route="resume"]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      if (window.location.hash === link.hash) return
      event.preventDefault()
      window.location.hash = link.hash
      window.location.reload()
    })
  })

  window.addEventListener('hashchange', function () {
    window.requestAnimationFrame(syncRoute)
  })

  new MutationObserver(syncAuthentication).observe(root, { childList: true, subtree: true })
  syncAuthentication()

  if (window.CMS && typeof window.CMS.registerEventListener === 'function') {
    window.CMS.registerEventListener({
      name: 'preSave',
      handler: function (opts) {
        var entry = opts.entry
        if (!entry || typeof entry.getIn !== 'function') return entry
        var next = String(entry.getIn(['data', 'downloadUrl']) || '').trim()
        var baseline = String(entry.getIn(['data', 'internalPrevUrl']) || '').trim()
        if (next === baseline) return entry
        var updated = entry
        if (next) updated = updated.setIn(['data', 'lastUpdated'], todayISO())
        return updated.setIn(['data', 'internalPrevUrl'], next)
      },
    })
  }

  function todayISO() {
    var date = new Date()
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0')
  }
})()
