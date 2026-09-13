const puppeteer = require('puppeteer');
const axios = require('axios')
const supa = require('@supabase/supabase-js')

const supabase = supa.createClient("https://urksffqejgoyacvhltis.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVya3NmZnFlamdveWFjdmhsdGlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4ODUxMDQsImV4cCI6MjA1MDQ2MTEwNH0.6LnuPY7mnKoHMMIuCYpZx72mBgcaauJDTKPhjZ10yxI");

puppeteer.launch({ dumpio: true }).then(async browser => {

    const URL_SITE = 'https://www.leilaoimovel.com.br/encontre-seu-imovel?s=&tipo=2,1,3&cidade=2301000,2304285,2304400&ordem=price_a&pag='

    const page = await browser.newPage();

    try {

        let imvsFinal = []
        let pagina = 0
        while (true) {
            pagina = pagina + 1
            console.log("alterando para pagina: " + URL_SITE + pagina)
            await page.goto(URL_SITE + pagina, {
                waitUntil: 'load'
            });

            await page.waitForSelector('body');
            let imvsInfo = await page.evaluate(() => {
                let imvsProcessados = []
                const processaImoveisHtml = (imvsHtml) => {
                    for (let i = 0; i < imvsHtml.length; i++) {
                        let imvHtml = imvsHtml[i]
                        let enderecoHtml = imvHtml.getElementsByClassName('address')[0]
                        let url = 'https://www.leilaoimovel.com.br' + imvHtml.getElementsByClassName('Link_Redirecter')[0].getAttribute('href')
                        let valorVenda = Number(imvHtml.getElementsByClassName('discount-price')[0].innerHTML.trim().replaceAll('R$ ', '').replaceAll('.', '').replaceAll(',', '.')).toFixed(2)
                        let valorOriginal = imvHtml.getElementsByClassName('last-price').length > 0 ?
                            Number(imvHtml.getElementsByClassName('last-price')[0].innerHTML.trim().replaceAll('R$ ', '').replaceAll('.', '').replaceAll(',', '.')).toFixed(2) : 0
                        let imagemUrl = imvHtml.querySelector('img').getAttribute('src')
                        let endereco = enderecoHtml.querySelector('span').innerHTML
                        let titulo = enderecoHtml.querySelector('b').innerHTML
                        let tipoImovel = titulo.includes('Apartamento') ? 2 : 1
                        let descricaoTipoImovel = tipoImovel === 1 ? 'Casa' : 'Apartamento'
                        imvsProcessados.push({
                            url,
                            valorVenda,
                            valorOriginal,
                            endereco,
                            imagemUrl,
                            titulo,
                            estado: 'CE',
                            cidade: 'Eusebio',
                            tipoNegocio: 1,
                            descricaoTipoNegocio: 'Leilão',
                            tipoImovel,
                            descricaoTipoImovel,
                            area: 0,
                            areaTerreno: 0,
                            vendido: 0
                        })

                    }
                }

                processaImoveisHtml(document.body.querySelectorAll('div.place-box:not([style*="display: none;"])'))
                return imvsProcessados;
            });

            if (imvsInfo.length === 0 || pagina == 15) {
                break
            } else {
                imvsFinal = imvsFinal.concat(imvsInfo)
            }

        }
        let postImv = []
        for (i = 0; i < imvsFinal.length; i++) {
            let imovel = imvsFinal[i]
            let location
            if (imovel.endereco !== null && imovel.endereco !== undefined && imovel.endereco !== '') {
                try {
                    let urlGeocode = 'https://maps.googleapis.com/maps/api/geocode/json?address=' + imovel.endereco.replaceAll(' ', '+') + '&key=AIzaSyBgqjErywYT_C7YU2XD_33UqhNXQkcbKfo'
                    console.log(i + ' - ' + urlGeocode)
                    let response = await axios.get(urlGeocode)
                    if (response.data.results.length > 0) {
                        location = response.data.results[0].geometry.location
                    } else {
                        location = { lat: 0, lng: 0 }
                    }
                    postImv.push({ ...imovel, location: location })
                } catch (e) {
                    console.log('Erro google')
                    console.log(e)
                }
            }
        }


        try {

            let cabecalho = 'titulo;endereco;lat;lng;url;estado;cidade;tipo_negocio;area;vendido;valor_venda;valor_original;imagem_url;tipo_imovel;area_terreno;origem_informacao\n'
            let origem = '2'
            const fs = require("fs");
            const filePath = 'C:/Users/andre/Downloads/leiloes.csv'
            fs.writeFileSync(filePath, cabecalho);
            for (let j = 0; j < postImv.length; j++) {
                let linha = postImv[j].titulo + ';' +
                    postImv[j].endereco + ';' +
                    postImv[j].location.lat + ';' +
                    postImv[j].location.lng + ';' +
                    postImv[j].url + ';' +
                    postImv[j].estado + ';' +
                    postImv[j].cidade + ';' +
                    postImv[j].tipoNegocio + ';' +
                    postImv[j].area + ';' +
                    postImv[j].vendido + ';' +
                    postImv[j].valorVenda + ';' +
                    postImv[j].valorOriginal + ';' +
                    postImv[j].imagemUrl + ';' +
                    postImv[j].tipoImovel + ';' +
                    postImv[j].areaTerreno + ';' +
                    origem + '\n'
                fs.writeFileSync(filePath, linha, { flag: 'a' });

            }
            console.log('arquivo salvo')

        } catch (e) {
            console.log('Erro 1')
            console.log(e)
        }

    } catch (e) {
        console.log('Erro 2')
        console.log(e)
    }

    await browser.close();

}).catch(function (err) {
    console.error(err);
});