const puppeteer = require('puppeteer');
const axios = require('axios')

puppeteer.launch({ dumpio: true }).then(async browser => {

    const URL_CARTA_SALVAR = 'http://localhost:8080/carta/atualizar/atualizacaoPreco'
    const URL_CARTA_CONSULTAR = 'http://localhost:8080/carta/consultar/atualizacaoPreco'

    const page = await browser.newPage();

    try {
        let response = await axios.get(URL_CARTA_CONSULTAR + '?quantidade=10&jogo=2')
        console.log('response consultar')
        console.log(response.data)
        
        //await response.data.map(async (carta) => {
        for (let carta of response.data) {
            console.log('carta')
            console.log(carta)
            
            urlBuscada = carta.linkCarta

            console.log("alterando para pagina: " + urlBuscada)
            await page.goto(urlBuscada, {
                waitUntil: 'load'
            });
            await page.waitForSelector('body');
            let cartaInfo = await page.evaluate(() => {
                const processarPreco = (valor) => {
                    let menor = parseFloat(valor.split("col-prc-menor\">")[1].split(" </div")[0].replace("R$ ", "").replace(",", "."))
                    let medio = parseFloat(valor.split("col-prc-medio\">")[1].split(" </div")[0].replace("R$ ", "").replace(",", "."))
                    return ((menor + medio) / 2).toFixed(2)
                }

                let preco = ''
                let cardInfo = document.body.querySelectorAll('#card-info')

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

                let items = { "preco": preco }

                return items;
            });
            let postCarta = { cartaId: carta.id, valor: cartaInfo.preco }
            try {
                if(Number(cartaInfo.preco) > 0.01){
                    await axios.post(URL_CARTA_SALVAR, postCarta)
                }
            } catch (e) {
                console.log('Erro 1')
                console.log(e)
            }
        }
    } catch (e) {
        console.log('Erro 2')
        console.log(e)
    }

    await browser.close();

}).catch(function (err) {
    console.error(err);
});