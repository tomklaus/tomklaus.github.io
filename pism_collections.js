(function() {
    'use strict';

	var Defined = {
	use_api: 'sourcestv',
	};

    if (Lampa && Lampa.Lang && typeof Lampa.Lang.add === 'function') {
        Lampa.Lang.add({
            sourcestv_menu_cinemas: { ru: 'Источники', en: 'Sources', uk: 'Джерела' },
            sourcestv_title_cinemas: { ru: 'Источники', en: 'Sources', uk: 'Джерела' },
            sourcestv_title_sort: { ru: 'Сортировка', en: 'Sort', uk: 'Сортування' },

            sourcestv_sort_popular: { ru: 'Популярные', en: 'Popular', uk: 'Популярні' },
            sourcestv_sort_rating_desc: { ru: 'Рейтинг', en: 'Rating', uk: 'Рейтинг' },
            sourcestv_sort_date_desc: { ru: 'Новые', en: 'Newest', uk: 'Нові' },
            sourcestv_sort_date_asc: { ru: 'Старые', en: 'Oldest', uk: 'Старі' },
            sourcestv_sort_vote_count: { ru: 'По голосам', en: 'Most voted', uk: 'За голосами' },

            sourcestv_cat_global_charts: { ru: 'Чарты', en: 'Charts', uk: 'Чарти' },
            sourcestv_cat_streaming: { ru: 'Стриминги', en: 'Streaming', uk: 'Стрімінги' },
            sourcestv_cat_us_tv: { ru: 'TV США', en: 'US TV', uk: 'TV США' },
            sourcestv_cat_world_tv: { ru: 'TV Мир', en: 'World TV', uk: 'TV Світ' },
            sourcestv_cat_ua: { ru: 'Украина', en: 'Ukraine', uk: 'Україна' },
            sourcestv_cat_ru: { ru: 'Россия', en: 'Russia', uk: 'Росія' },

            sourcestv_cat_popular: { ru: 'Популярные', en: 'Popular', uk: 'Популярні' },
            sourcestv_cat_top_rated: { ru: 'Топ-250', en: 'Top 250', uk: 'Топ-250' },
            sourcestv_cat_airing_today: { ru: 'Сегодня в эфире', en: 'Airing today', uk: 'Сьогодні в ефірі' },
            sourcestv_cat_on_the_air: { ru: 'Скоро', en: 'Upcoming', uk: 'Незабаром' },
            sourcestv_cat_most_voted: { ru: 'Самые обсуждаемые', en: 'Most voted', uk: 'Найбільше голосів' },
            sourcestv_cat_trending: { ru: 'В тренде', en: 'Trending', uk: 'У тренді' }
        });
    }

    function safeTranslate(key, fallback) {
        if (Lampa && Lampa.Lang && typeof Lampa.Lang.translate === 'function') {
            return Lampa.Lang.translate(key) || fallback || key;
        }
        return fallback || key;
    }

    var categories = [
        {
            id: 'global',
            key: 'sourcestv_cat_global_charts',
            list: [
                { key: 'sourcestv_cat_popular', type: 'popular', endpoint: 'tv/popular' },
                { key: 'sourcestv_cat_top_rated', type: 'top_rated', endpoint: 'tv/top_rated' },
                { key: 'sourcestv_cat_airing_today', type: 'airing_today', endpoint: 'tv/airing_today' },
                { key: 'sourcestv_cat_on_the_air', type: 'on_the_air', endpoint: 'tv/on_the_air' },
                { key: 'sourcestv_cat_most_voted', type: 'most_voted', endpoint: 'discover/tv', sort: 'vote_count.desc' },
                { key: 'sourcestv_cat_trending', type: 'trending', endpoint: 'trending/tv/week' }
            ]
        },
        {
            id: 'streaming',
            key: 'sourcestv_cat_streaming',
            list: [
                { name: 'Netflix', networkId: '213' },
                { name: 'Prime Video', networkId: '1024' },
                { name: 'Disney+', networkId: '2739' },
                { name: 'Max', networkId: '3186' },
                { name: 'Hulu', networkId: '453' },
                { name: 'Apple TV+', networkId: '2552' },
                { name: 'Paramount+', networkId: '4330' },
                { name: 'Peacock', networkId: '3353' }
            ]
        },
        {
            id: 'us_tv',
            key: 'sourcestv_cat_us_tv',
            list: [
                { name: 'NBC', networkId: '6' },
                { name: 'CBS', networkId: '16' },
                { name: 'ABC', networkId: '2' },
                { name: 'FOX', networkId: '19' },
                { name: 'The CW', networkId: '71' },
                { name: 'AMC', networkId: '174' },
                { name: 'TNT', networkId: '41' },
                { name: 'Syfy', networkId: '77' },
                { name: 'Cartoon Network', networkId: '56' },
                { name: 'Adult Swim', networkId: '80' }
            ]
        },
        {
            id: 'world_tv',
            key: 'sourcestv_cat_world_tv',
            list: [
                { name: 'BBC One', networkId: '4' },
                { name: 'BBC Two', networkId: '332' },
                { name: 'ITV1', networkId: '9' },
                { name: 'Channel 4', networkId: '26' },
                { name: 'ZDF', networkId: '31' },
                { name: 'Das Erste', networkId: '308' },
                { name: 'TVNZ 1', networkId: '1376' }
            ]
        },
        {
            id: 'ua',
            key: 'sourcestv_cat_ua',
            list: [
                { name: '1+1', networkId: '1254' },
                { name: 'ICTV', networkId: '1166' },
                { name: 'СТБ', networkId: '1206' },
                { name: 'Новий канал', networkId: '3510' },
                { name: 'Україна', networkId: '1625' },
                { name: 'Inter', networkId: '1635' },
                { name: '2+2', networkId: '5947' },
                { name: 'ТЕТ', networkId: '1326' },
                { name: '1+1 Україна', networkId: '7496' }
            ]
        },
        {
            id: 'ru',
            key: 'sourcestv_cat_ru',
            list: [
                { name: 'START', networkId: '2493' },
                { name: 'Premier', networkId: '2859' },
                { name: 'Кинопоиск', networkId: '3827' },
                { name: 'Okko', networkId: '3871' },
                { name: 'ИВИ', networkId: '3923' },
                { name: 'KION', networkId: '4085' },
                { name: 'Wink', networkId: '5806' },
                { name: 'Смотрим', networkId: '5000' },
                { name: 'Первый канал', networkId: '558' },
                { name: 'Россия 1', networkId: '412' },
                { name: 'ТНТ', networkId: '1191' },
                { name: 'СТС', networkId: '806' },
                { name: 'НТВ', networkId: '1199' },
                { name: 'Пятница', networkId: '3031' },
                { name: 'РЕН ТВ', networkId: '681' },
                { name: 'Домашний', networkId: '1325' }
            ]
        }
    ];

    var sortOptions = [
        { key: 'sourcestv_sort_popular', sort: 'popularity.desc' },
        { key: 'sourcestv_sort_rating_desc', sort: 'vote_average.desc' },
        { key: 'sourcestv_sort_date_desc', sort: 'first_air_date.desc' },
        { key: 'sourcestv_sort_date_asc', sort: 'first_air_date.asc' },
        { key: 'sourcestv_sort_vote_count', sort: 'vote_count.desc' }
    ];

    function getTitle(item) {
        if (item.key) return safeTranslate(item.key, item.name);
        return item.name;
    }

    function chooseSort(net) {
        if (net.type) {
            var push = {
                url: net.endpoint,
                title: net.title,
                component: 'category_full',
                source: 'tmdb',
                card_type: true,
                page: 1
            };
            if (net.sort) push.sort_by = net.sort;
            Lampa.Activity.push(push);
        } else {
            var items = sortOptions.map(function(opt) {
                return { title: safeTranslate(opt.key), sort: opt.sort };
            });
            Lampa.Select.show({
                title: safeTranslate('sourcestv_title_sort'),
                items: items,
                onSelect: function(sortItem) {
                    Lampa.Activity.push({
                        url: 'discover/tv',
                        title: net.title,
                        networks: net.networkId,
                        sort_by: sortItem.sort,
                        component: 'category_full',
                        source: 'tmdb',
                        card_type: true,
                        page: 1
                    });
                },
                onBack: function() {
                    chooseCinema(net.category);
                }
            });
        }
    }

    function chooseCinema(categoryId) {
        var category = categories.find(function(c) { return c.id === categoryId; });
        if (!category) return;

        var items = category.list.map(function(item) {
            if (item.networkId) {
                return {
                    title: getTitle(item),
                    category: categoryId,
                    networkId: item.networkId
                };
            } else {
                return {
                    title: getTitle(item),
                    category: categoryId,
                    type: item.type,
                    endpoint: item.endpoint,
                    sort: item.sort
                };
            }
        });

        Lampa.Select.show({
            title: getTitle(category),
            items: items,
            onSelect: chooseSort,
            onBack: chooseCategory
        });
    }

    function chooseCategory() {
        var items = categories.map(function(c) {
            return { title: getTitle(c), category: c.id };
        });
        Lampa.Select.show({
            title: safeTranslate('sourcestv_title_cinemas'),
            items: items,
            onSelect: function(cat) {
                chooseCinema(cat.category);
            },
            onBack: function() {
                Lampa.Menu.open();
            }
        });
    }

    function startPlugin() {
        if (typeof $ !== 'function' || !Lampa) {
            return;
        }
		window['plugin_' + Defined.use_api + '_ready'] = true;

        function findMenuAndAdd() {
            var $menu = $('.menu .menu__list').eq(0);
            if ($menu.length) {
                try {
                    var button = $(
                        '<li class="menu__item selector">' +
                        '  <div class="menu__ico">' +
                        '    <svg viewBox="0 0 491.52 491.52" fill="currentColor" xmlns="http://www.w3.org/2000/svg">' +
                        '      <path d="M434.269,403.635c0.083-0.083,0.158-0.173,0.24-0.257c0.373-0.384,0.73-0.774,1.065-1.172 c0.056-0.067,0.108-0.137,0.162-0.205c3.43-4.178,4.832-9.099,4.567-13.864V20.48c0-11.311-9.169-20.48-20.48-20.48H102.732 C74.259,0,51.184,23.075,51.184,51.548v378.37c0,0.054-0.004,0.108-0.004,0.162c0,33.941,27.499,61.44,61.44,61.44h307.2 c18.246,0,27.383-22.06,14.482-34.962C415.01,437.268,415,422.92,434.269,403.635z M399.344,368.64h-40.964V40.96h40.964V368.64z M92.144,51.548c0-5.852,4.737-10.588,10.588-10.588h214.688v327.68H112.624h-0.004c-0.008,0-0.015,0.001-0.023,0.001 c-0.978,0-1.949,0.028-2.916,0.074c-0.326,0.015-0.648,0.042-0.973,0.063c-0.65,0.041-1.298,0.087-1.942,0.148 c-0.374,0.035-0.746,0.078-1.119,0.12c-0.594,0.067-1.185,0.141-1.773,0.225c-0.381,0.054-0.761,0.111-1.14,0.172 c-0.587,0.095-1.171,0.201-1.752,0.313c-0.36,0.069-0.721,0.135-1.079,0.21c-0.655,0.138-1.303,0.292-1.95,0.45 c-0.272,0.067-0.547,0.125-0.817,0.195c-0.895,0.232-1.783,0.484-2.662,0.756c-0.282,0.087-0.558,0.186-0.838,0.276 c-0.499,0.162-1,0.318-1.493,0.492V51.548z M382.34,450.56h-269.72c-11.32,0-20.48-9.16-20.48-20.48h0.004 c0-11.32,9.16-20.48,20.48-20.48H382.34C377.706,423.174,377.706,436.986,382.34,450.56z"></path>' +
                        '      <path d="M194.539,245.76h81.92c11.311,0,20.48-9.169,20.48-20.48s-9.169-20.48-20.48-20.48h-81.92 c-11.311,0-20.48,9.169-20.48,20.48S183.229,245.76,194.539,245.76z"></path>' +
                        '      <path d="M153.579,327.68h122.88c11.311,0,20.48-9.169,20.48-20.48s-9.169-20.48-20.48-20.48h-122.88 c-11.311,0-20.48,9.169-20.48,20.48S142.269,327.68,153.579,327.68z"></path>' +
                        '    </svg>' +
                        '  </div>' +
                        '  <div class="menu__text">' + safeTranslate('sourcestv_menu_cinemas') + '</div>' +
                        '</li>'
                    );

                    button.on('hover:enter', chooseCategory);
                    $menu.append(button);
                } catch (e) {}
            } else {
                setTimeout(findMenuAndAdd, 200);
            }
        }

        findMenuAndAdd();
    }

	if (!window['plugin_' + Defined.use_api + '_ready']) {
		startPlugin();
	}

})();
