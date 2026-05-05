// mobile.js — hamburger nav + table wrapping for all pages
(function () {
    'use strict';

    /* ── Hamburger menu ─────────────────────────────────────── */
    var header = document.getElementById('header');
    if (header) {
        var nav = header.querySelector('nav');

        var btn = document.createElement('button');
        btn.className = 'nav-toggle';
        btn.id = 'navToggle';
        btn.setAttribute('aria-label', 'Toggle navigation');
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = '&#9776;';
        header.appendChild(btn);

        function openNav() {
            header.classList.add('nav-open');
            btn.innerHTML = '&#10005;'; // ✕
            btn.setAttribute('aria-expanded', 'true');
            if (nav) nav.style.height = nav.scrollHeight + 'px';
        }

        function closeNav() {
            header.classList.remove('nav-open');
            btn.innerHTML = '&#9776;'; // ☰
            btn.setAttribute('aria-expanded', 'false');
            if (nav) nav.style.height = '0';
        }

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            header.classList.contains('nav-open') ? closeNav() : openNav();
        });

        // Close when any nav link is tapped
        if (nav) {
            nav.querySelectorAll('a').forEach(function (a) {
                a.addEventListener('click', closeNav);
            });
        }

        // Close on outside tap / click
        document.addEventListener('click', function (e) {
            if (!header.contains(e.target)) closeNav();
        });
    }

    /* ── Wrap tables for horizontal scrolling ───────────────── */
    document.querySelectorAll('table').forEach(function (table) {
        // Skip tables already inside a scroll wrapper
        if (table.parentElement && table.parentElement.classList.contains('table-scroll-wrapper')) return;
        var wrapper = document.createElement('div');
        wrapper.className = 'table-scroll-wrapper';
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
    });

})();
