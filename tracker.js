(function () {
    'use strict';

    // ============================================================
    // КОНФІГ
    // ============================================================
    var PLUGIN_TAG  = 'ua_series_tracker';
    var STORE_KEY   = 'ua_tracker_v2';
    var TMDB_KEY    = '4ef0d7355d9ffb5151e987764708ce96';
    var TMDB_BASE   = 'https://api.themoviedb.org/3';
    var IMG_BASE    = 'https://image.tmdb.org/t/p/w92';

    // ============================================================
    // СХОВИЩЕ
    // ============================================================
    var Store = {
        get: function () {
            var raw = Lampa.Storage.get(STORE_KEY, 'false');
            try { return JSON.parse(raw) || {}; } catch(e) { return {}; }
        },
        set: function (data) {
            Lampa.Storage.set(STORE_KEY, JSON.stringify(data));
        },
        getShow: function (id) {
            return this.get()[String(id)] || null;
        },
        setShow: function (show) {
            var data = this.get();
            data[String(show.id)] = show;
            this.set(data);
        },
        removeShow: function (id) {
            var data = this.get();
            delete data[String(id)];
            this.set(data);
        },
        all: function () {
            var data = this.get();
            return Object.keys(data).map(function(k){ return data[k]; });
        }
    };

    // ============================================================
    // TMDB
    // ============================================================
    function tmdbGet(path, callback, fail) {
        var sep = path.indexOf('?') >= 0 ? '&' : '?';
        var url = TMDB_BASE + path + sep + 'api_key=' + TMDB_KEY + '&language=uk-UA';
        $.ajax({
            url: url,
            type: 'GET',
            dataType: 'json',
            success: callback,
            error: fail || function(){}
        });
    }

    function fetchUnwatched(show, callback) {
        var today = new Date().toISOString().slice(0, 10);
        tmdbGet('/tv/' + show.id, function (info) {
            var seasons = (info.seasons || []).filter(function(s){
                return s.season_number > 0;
            });
            if (!seasons.length) return callback([]);

            var results = [];
            var left    = seasons.length;

            seasons.forEach(function (s) {
                tmdbGet('/tv/' + show.id + '/season/' + s.season_number, function (sd) {
                    (sd.episodes || []).forEach(function (ep) {
                        if (!ep.air_date || ep.air_date > today) return;
                        var key = 's' + ep.season_number + 'e' + ep.episode_number;
                        if (show.watched && show.watched[key]) return;
                        // тільки серії після останньої переглянутої
                        var sn = ep.season_number, en = ep.episode_number;
                        var ls = show.last_season || 0, le = show.last_episode || 0;
                        var isNew = (sn > ls) || (sn === ls && en > le);
                        if (isNew) {
                            results.push({
                                key:     key,
                                season:  sn,
                                episode: en,
                                title:   ep.name || ('Серія ' + en),
                                date:    ep.air_date
                            });
                        }
                    });
                    if (--left === 0) callback(results);
                }, function(){ if (--left === 0) callback(results); });
            });
        }, function(){ callback([]); });
    }

    // ============================================================
    // ПЕРЕВІРКА ВСІХ СЕРІАЛІВ
    // ============================================================
    function checkAll(notify) {
        var shows = Store.all();
        shows.forEach(function (show) {
            fetchUnwatched(show, function (eps) {
                if (!eps.length) return;
                var stored = Store.getShow(show.id);
                if (!stored) return;
                var existing = (stored.unwatched || []).map(function(e){ return e.key; });
                var added = 0;
                eps.forEach(function (ep) {
                    if (existing.indexOf(ep.key) < 0) {
                        stored.unwatched = stored.unwatched || [];
                        stored.unwatched.push(ep);
                        added++;
                    }
                });
                if (added) {
                    Store.setShow(stored);
                    if (notify) {
                        Lampa.Noty.show(
                            '📺 ' + stored.title + ': +' + added + ' ' +
                            (added === 1 ? 'нова серія' : 'нових серій') +
                            (stored.voice ? '  🎙 ' + stored.voice : '')
                        );
                    }
                }
            });
        });
    }

    // ============================================================
    // ВІДМІТИТИ ПЕРЕГЛЯНУТОЮ
    // ============================================================
    function markWatched(showId, season, episode, voice) {
        var show = Store.getShow(showId);
        if (!show) return;
        var key = 's' + season + 'e' + episode;
        show.watched       = show.watched || {};
        show.watched[key]  = true;
        show.last_season   = Math.max(show.last_season  || 0, season);
        show.last_episode  = (season === show.last_season) 
                              ? Math.max(show.last_episode || 0, episode) 
                              : episode;
        if (voice) show.voice = voice;
        show.unwatched = (show.unwatched || []).filter(function(e){ return e.key !== key; });
        Store.setShow(show);
    }

    // ============================================================
    // ПЕРЕХОПЛЕННЯ ПЛЕЄРА
    // ============================================================
    Lampa.Listener.follow('player', function (e) {
        if (e.type === 'start') {
            var obj = e.object || {};
            var card = obj.movie || obj.card || {};
            if (!card.id) return;
            // серіал визначаємо за наявністю first_air_date або media_type
            var isTv = card.media_type === 'tv' ||
                       card.first_air_date !== undefined ||
                       typeof obj.season !== 'undefined';
            if (!isTv) return;

            window._tracker_ctx = {
                id:      card.id,
                title:   card.name || card.title || '',
                poster:  card.poster_path || '',
                season:  parseInt(obj.season,  10) || 0,
                episode: parseInt(obj.episode, 10) || 0,
                voice:   obj.voice || obj.translation || obj.t || ''
            };
        }

        if (e.type === 'end' || e.type === 'destroy') {
            var ctx = window._tracker_ctx;
            if (!ctx || !ctx.season) { window._tracker_ctx = null; return; }

            // перевіряємо % перегляду
            var pct = 0;
            try {
                var v = document.querySelector('video');
                if (v && v.duration) pct = v.currentTime / v.duration * 100;
            } catch(_){}

            if (pct >= 80 || e.type === 'end') {
                // додаємо серіал якщо його ще немає
                if (!Store.getShow(ctx.id)) {
                    Store.setShow({
                        id: ctx.id, title: ctx.title, poster: ctx.poster,
                        voice: ctx.voice, watched: {}, unwatched: [],
                        last_season: 0, last_episode: 0
                    });
                }
                markWatched(ctx.id, ctx.season, ctx.episode, ctx.voice);
            }
            window._tracker_ctx = null;
        }
    });

    // ============================================================
    // UI — СТИЛІ
    // ============================================================
    function injectStyles() {
        if (document.getElementById('ua-tracker-css')) return;
        var s = document.createElement('style');
        s.id = 'ua-tracker-css';
        s.textContent = '\
.trk-wrap{padding:1.5em 2em;color:#fff;overflow-y:auto;height:100%;box-sizing:border-box}\
.trk-h1{font-size:1.7em;margin-bottom:.3em}\
.trk-sub{color:#aaa;font-size:.9em;margin-bottom:1.5em}\
.trk-btn{display:inline-block;background:#e5a00d;color:#000;border:none;\
  padding:.45em 1.4em;border-radius:.4em;cursor:pointer;font-size:.95em;\
  margin-right:.5em;margin-bottom:1.2em;font-weight:600}\
.trk-btn:focus,.trk-btn.focus{outline:2px solid #fff}\
.trk-empty{text-align:center;margin-top:4em;color:#888;font-size:1.1em}\
.trk-show{margin-bottom:2em;border-left:3px solid #e5a00d;padding-left:1em}\
.trk-show-head{display:flex;align-items:center;gap:.7em;margin-bottom:.5em}\
.trk-show-img{height:3em;border-radius:.3em;flex-shrink:0}\
.trk-show-name{font-size:1.1em;font-weight:600}\
.trk-show-voice{font-size:.8em;color:#e5a00d;margin-top:.15em}\
.trk-ep{display:flex;align-items:center;background:rgba(255,255,255,.06);\
  border-radius:.4em;padding:.45em .9em;margin-bottom:.35em;gap:.7em}\
.trk-ep:focus,.trk-ep.focus{background:rgba(255,255,255,.18);outline:none}\
.trk-ep-num{color:#e5a00d;font-weight:700;min-width:5em;font-size:.95em}\
.trk-ep-title{flex:1;font-size:.95em}\
.trk-ep-date{color:#777;font-size:.8em;white-space:nowrap}\
.trk-ep-ok{background:none;border:1px solid #555;color:#5f5;padding:.2em .6em;\
  border-radius:.3em;cursor:pointer;font-size:.85em;white-space:nowrap}\
.trk-ep-ok:hover{background:#5f5;color:#000}\
';
        document.head.appendChild(s);
    }

    // ============================================================
    // UI — КОМПОНЕНТ ТРЕКЕРА
    // ============================================================
    function TrackerPage(object) {
        this._object = object;
        this._wrap   = $('<div class="trk-wrap"></div>');
    }

    TrackerPage.prototype = {
        // --- обов'язкові методи Lampa компонента ---
        create: function () {
            injectStyles();
            this._draw();
            return this._wrap;
        },
        render: function () { return this._wrap; },
        start:  function () {
            var wrap = this._wrap;
            Lampa.Controller.add(PLUGIN_TAG, {
                toggle: function () {
                    Lampa.Controller.collectionSet(wrap);
                    Lampa.Controller.collectionFocus(false, wrap);
                },
                up:    function () { Lampa.Controller.collectionUp(); },
                down:  function () { Lampa.Controller.collectionDown(); },
                back:  function () { Lampa.Activity.backward(); }
            });
            Lampa.Controller.toggle(PLUGIN_TAG);
        },
        pause:   function () {},
        stop:    function () {},
        destroy: function () { this._wrap.remove(); },

        // --- відмальовка ---
        _draw: function () {
            var self = this;
            var wrap = this._wrap.empty();

            wrap.append('<div class="trk-h1">📺 Трекер серіалів</div>');
            wrap.append('<div class="trk-sub">Всі непереглянуті серії в одному місці</div>');

            // кнопка "Перевірити"
            var btnCheck = $('<button class="trk-btn selector">🔄 Перевірити нові серії</button>');
            btnCheck.on('click hover:enter', function () {
                Lampa.Noty.show('Перевіряю…');
                checkAll(true);
                setTimeout(function () { self._draw(); }, 4000);
            });
            wrap.append(btnCheck);

            var shows = Store.all().filter(function(s){
                return s.unwatched && s.unwatched.length;
            });

            if (!shows.length) {
                wrap.append('<div class="trk-empty">🎉 Непереглянутих серій немає!<br><span style="font-size:.85em;color:#666">Натисніть «Стежити» на сторінці серіалу</span></div>');
                return;
            }

            shows.forEach(function (show) {
                var block = $('<div class="trk-show"></div>');

                // заголовок серіалу
                var head = $('<div class="trk-show-head"></div>');
                if (show.poster) {
                    head.append('<img class="trk-show-img" src="' + IMG_BASE + show.poster + '">');
                }
                var info = $('<div></div>');
                info.append('<div class="trk-show-name">' + Lampa.Utils.escapeHtml(show.title) + '</div>');
                if (show.voice) {
                    info.append('<div class="trk-show-voice">🎙 ' + Lampa.Utils.escapeHtml(show.voice) + '</div>');
                }
                head.append(info);
                block.append(head);

                // список серій
                var sorted = (show.unwatched || []).slice().sort(function(a,b){
                    return a.season !== b.season ? a.season - b.season : a.episode - b.episode;
                });

                sorted.forEach(function (ep) {
                    var pad = function(n){ return String(n).padStart(2,'0'); };
                    var row = $(
                        '<div class="trk-ep selector" tabindex="0">' +
                        '<span class="trk-ep-num">S' + pad(ep.season) + 'E' + pad(ep.episode) + '</span>' +
                        '<span class="trk-ep-title">' + Lampa.Utils.escapeHtml(ep.title) + '</span>' +
                        '<span class="trk-ep-date">' + (ep.date || '') + '</span>' +
                        '<button class="trk-ep-ok selector">✓ Переглянуто</button>' +
                        '</div>'
                    );

                    row.find('.trk-ep-ok').on('click hover:enter', function (ev) {
                        ev.stopPropagation();
                        markWatched(show.id, ep.season, ep.episode, show.voice);
                        row.fadeOut(200, function(){ row.remove(); });
                        Lampa.Noty.show('✓ Відмічено як переглянуте');
                    });

                    block.append(row);
                });

                wrap.append(block);
            });
        }
    };

    // ============================================================
    // РЕЄСТРАЦІЯ КОМПОНЕНТА
    // ============================================================
    Lampa.Component.add(PLUGIN_TAG, TrackerPage);

    // ============================================================
    // КНОПКА В МЕНЮ
    // ============================================================
    function addMenuBtn() {
        Lampa.Listener.follow('menu', function (e) {
            if (e.type !== 'build') return;

            var total = Store.all().reduce(function(n, s){
                return n + ((s.unwatched && s.unwatched.length) || 0);
            }, 0);

            var badge = total
                ? ' <sup style="background:#e55;border-radius:1em;padding:.05em .45em;font-size:.7em;">' + total + '</sup>'
                : '';

            var item = $(
                '<li class="menu__item selector">' +
                '<div class="menu__ico">📺</div>' +
                '<div class="menu__text">Трекер' + badge + '</div>' +
                '</li>'
            );

            item.on('hover:enter', function () {
                Lampa.Activity.push({
                    title:     'Трекер серіалів',
                    component: PLUGIN_TAG,
                    page:      1
                });
            });

            // вставляємо після першого пункту меню
            e.render.find('.menu__list').first().append(item);
        });
    }

    // ============================================================
    // КНОПКА "СТЕЖИТИ" НА СТОРІНЦІ СЕРІАЛУ
    // ============================================================
    Lampa.Listener.follow('full', function (e) {
        if (e.type !== 'complite') return;

        var movie = (e.data && e.data.movie) || e.movie || {};
        // тільки серіали
        if (!movie.id || movie.media_type === 'movie') return;
        if (!movie.first_air_date && !movie.number_of_seasons) return;

        var id      = movie.id;
        var tracked = !!Store.getShow(id);

        var btn = $(
            '<button class="full-start__button selector" style="margin-top:.6em;background:' +
            (tracked ? '#27ae60' : '#2980b9') + '">' +
            (tracked ? '📺 Відстежується' : '＋ Стежити') +
            '</button>'
        );

        btn.on('hover:enter click', function () {
            if (Store.getShow(id)) {
                Store.removeShow(id);
                btn.text('＋ Стежити').css('background','#2980b9');
                Lampa.Noty.show('Серіал видалено з відстеження');
            } else {
                var show = {
                    id:           id,
                    title:        movie.name || movie.title || String(id),
                    poster:       movie.poster_path || '',
                    voice:        '',
                    watched:      {},
                    unwatched:    [],
                    last_season:  0,
                    last_episode: 0
                };
                Store.setShow(show);
                btn.text('📺 Відстежується').css('background','#27ae60');
                Lampa.Noty.show('Додано! Шукаю нові серії…');
                fetchUnwatched(show, function (eps) {
                    if (!eps.length) {
                        Lampa.Noty.show('Нових серій поки немає');
                        return;
                    }
                    var s = Store.getShow(id);
                    if (!s) return;
                    s.unwatched = eps;
                    Store.setShow(s);
                    Lampa.Noty.show('📺 Знайдено ' + eps.length + ' непереглянутих серій!');
                });
            }
        });

        // вставляємо кнопку у блок дій серіалу
        var btns = e.render
            .find('.full-start__buttons, .full-start-new__buttons, .full-start__body')
            .first();
        if (btns.length) btns.append(btn);
    });

    // ============================================================
    // СТАРТ
    // ============================================================
    function init() {
        addMenuBtn();
        // перевірка нових серій через 8 сек після запуску
        setTimeout(function () { checkAll(true); }, 8000);
    }

    // Чекаємо готовності Lampa
    if (window.Lampa && Lampa.Listener && Lampa.Storage) {
        init();
    } else {
        var _t = setInterval(function () {
            if (window.Lampa && Lampa.Listener && Lampa.Storage) {
                clearInterval(_t);
                init();
            }
        }, 250);
    }

})();
