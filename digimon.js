const puppeteer = require('puppeteer');
const axios = require('axios')

puppeteer.launch({ dumpio: true }).then(async browser => {
    const urlBuscada = 'https://www.ligadigimon.com.br/?view=cards%2Fsearch&card=ed%3DP1+searchprod%3D0&tipo=1'
    const EDICAO_ID = 133

    const page = await browser.newPage();
    const URL_SALVAR_CARTA_RASPADA = 'http://localhost:8080/carta/raspada/digimon/salvar'
    //const URL_SALVAR_CARTA_RASPADA = 'https://services-tcg.herokuapp.com/carta/raspada/digimon/salvar'

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
    // await page.screenshot({
    //     path: 'yoursite.png',
    //     fullPage: true
    // });

    let grabCardsLink = await page.evaluate(() => {
        const processarLink = (html) => {
            const URL_BASE = "https://www.ligadigimon.com.br/"
            if (html === null) { return null }
            let partes = html.split('>').filter(parte => {
                if (parte.includes("href")) {
                    return parte
                }
            })
            return URL_BASE + partes[0].replace("<a href=\".\/", "").replaceAll("\"", "").replaceAll("amp;", "")
        }

        let allCards = document.body.querySelectorAll('.card-item');

        scrapeItems = [];
        allCards.forEach(item => {
            let link = processarLink(item ? item.innerHTML : null)
            scrapeItems.push({
                link: link
            });
        });

        let items = {
            "links": scrapeItems,
        };
        return items;
    });

    for (let link of grabCardsLink.links) {
        try {
            console.log("alterando para pagina: " + link.link)
            await page.goto(link.link, {
                waitUntil: 'load'
            });
            await page.waitForSelector('body');
            let cartaInfo = await page.evaluate(() => {
                const processarNome = (nome) => {
                    return nome.replaceAll("<span>", "").replaceAll("</span>\n", "")
                }
                const processarPreco = (valor) => {
                    let menor = parseFloat(valor.split("col-prc-menor\">")[1].split(" </div")[0].replace("R$ ", "").replace(",", "."))
                    let medio = parseFloat(valor.split("col-prc-medio\">")[1].split(" </div")[0].replace("R$ ", "").replace(",", "."))
                    return ((menor + medio) / 2).toFixed(2)
                }

                let preco = ''
                let cardInfo = document.body.querySelectorAll('#card-info')

                let nome = processarNome(cardInfo[0].querySelectorAll('.nome-principal')[0].innerHTML).split(" (")[0].replaceAll('amp;', '')
                let numero = document.body.querySelectorAll('#ed-numero')[0].innerHTML
                let precos = cardInfo[0].querySelectorAll('.desktop-price-lines-0')[0].querySelectorAll('div')
               
                for (let i = 0; i < precos.length; i++) {
                    let x = precos[i].parentElement
                    if (x.innerHTML.includes("Preço Médio card Normal")) {
                        if (x.innerHTML.includes("col-prc-medio")) {
                            let y = x.querySelectorAll('div')
                            for (let j = 0; j < y.length; j++) {
                                if (y[j].innerHTML.includes('bloco-preco-superior')) {
                                    preco = processarPreco(y[j].innerHTML)
                                }
                            }
                        }
                    }

                }


                let imagem = document.body.querySelectorAll('#card-image-src')[0].querySelector('img').getAttribute('src')
                let cardDetalhes = cardInfo[0].getElementsByClassName('row detalhes')
                let edicao = cardDetalhes[2].querySelector('a').innerHTML
                let raridade = document.body.querySelectorAll('#ed-raridade')[0].innerHTML

                let anoEdicao = cardDetalhes[2].querySelector('span').innerHTML.replace("(L:", "").replace(")", "").replaceAll(/\s/g, "")
                let edicaoLogo = document.body.querySelectorAll('.bloco-edicoes')[0].querySelector('img').getAttribute('src')

                let items = {
                    "cartaRaspadaTO": {
                        nome,
                        numero,
                        imagem,
                        raridade,
                        preco
                    },
                    "edicaoRaspadaTO": {
                        edicao,
                        edicaoLogo,
                        anoEdicao
                    }
                };
                return items;
            });
            let postCarta = { cartaRaspadaTO: cartaInfo.cartaRaspadaTO, edicaoRaspadaTO: {...cartaInfo.edicaoRaspadaTO, id: EDICAO_ID,}, link: link.link }
            try {
                let response = await axios.post(URL_SALVAR_CARTA_RASPADA, postCarta)
            } catch (e) {
                console.log('Erro 2')
                console.log(e)
            }
            //console.log(response)
        } catch (e) {
            console.error(e)
        }
    }
   
    await browser.close();


}).catch(function (err) {
    console.error(err);
});