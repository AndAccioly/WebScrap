const puppeteer = require('puppeteer');
const axios = require('axios')

puppeteer.launch({ dumpio: true }).then(async browser => {
    const urlBuscada = 'https://www.betano.bet.br/sport/futebol/jogos-de-hoje/'

    const page = await browser.newPage();

    async function autoScroll(page, maxScrolls) {
        await page.evaluate(async (maxScrolls) => {
            await new Promise((resolve) => {
                var totalHeight = 0;
                var distance = 100;
                var scrolls = 0;  // scrolls counter
                var timer = setInterval(() => {
                    var scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    scrolls++;
                    if (totalHeight >= scrollHeight - window.innerHeight || scrolls >= maxScrolls) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 250);
            });
        }, maxScrolls);
    }


    await page.goto(urlBuscada);
    await page.waitForSelector('body');
    await page.setViewport({
        width: 1200,
        height: 800
    });
    await autoScroll(page, 200);

    let games = await page.evaluate(() => {
        
        let pagina_jogos = document.body.querySelectorAll('.vue-recycle-scroller__item-view');

        scrapeItems = [];
        pagina_jogos.forEach(item => {
            console.log(item)
            scrapeItems.push({
                time1: '',
                time2: '',
                url: '',
                odd1: 0,
                odd2: 3,
                odd3: 0
            });
        });

        let items = {
            "links": scrapeItems,
        };
        return items;
    });

    console.log(games)

    await browser.close();


}).catch(function (err) {
    console.error(err);
});