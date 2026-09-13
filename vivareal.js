const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const axios = require('axios')
const supa = require('@supabase/supabase-js')

const supabase = supa.createClient("https://urksffqejgoyacvhltis.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVya3NmZnFlamdveWFjdmhsdGlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4ODUxMDQsImV4cCI6MjA1MDQ2MTEwNH0.6LnuPY7mnKoHMMIuCYpZx72mBgcaauJDTKPhjZ10yxI");

puppeteer.use(StealthPlugin())

//ALTERAR URL
//ALTERAR MAXIMO PAGINA
//ALTERAR BAIRRO
puppeteer.launch({ dumpio: true }).then(async browser => {

    const URL_SITE = 'https://www.vivareal.com.br/aluguel/ceara/eusebio/?pagina='
    const URL_SITE_PAGINA = '#onde=,Ceará,Eusébio,,,,,city,BR>Ceara>NULL>Eusebio,,,'


    const page = await browser.newPage();

    try {

        let imvsFinal = []
        let pagina = 0
        while (true) {
            pagina = pagina + 1
            console.log("alterando para pagina: " + URL_SITE + pagina + URL_SITE_PAGINA)
            console.log('REGISTRO ' + pagina)
            await page.goto(URL_SITE + pagina + URL_SITE_PAGINA, {
                waitUntil: 'load'
            });
            await page.waitForSelector('body');
            await page.waitForTimeout(5000);

            let imvsInfo = await page.evaluate(() => {
                let imvsProcessados = []
                let totalPagina = 0
                const processaImoveisHtml = async (imvsHtml) => {
                    try {
                        for (let i = 0; i < imvsHtml.length; i++) { 
                            let imvHtml = imvsHtml[i]
                            if (imvHtml.innerHTML.includes('Encontramos mais')) {
                                break;
                            }
                            if (imvHtml.innerHTML.includes('Sob Consulta')) {
                                totalPagina = totalPagina + 1
                                continue
                            }
                            let detalhes = imvHtml.getElementsByClassName('property-card__details')[0]
                            let url = 'https://www.vivareal.com.br' + imvHtml.getElementsByClassName('property-card__main-link')[0].querySelector('a').getAttribute('href')
                            let imagemUrl = imvHtml.getElementsByClassName('carousel__image')[0].getAttribute('src')
                            let valorVenda = Number(imvHtml.getElementsByClassName('property-card__price')[0].querySelector('p').innerHTML.trim().replaceAll('R$ ', '').replaceAll('.', '').replaceAll(' ', '').replaceAll('\"', '').replaceAll(',', '.')).toFixed(2)
                            let valorOriginal = valorVenda
                            let endereco = imvHtml.getElementsByClassName('property-card__address')[0].innerHTML
                            let titulo = imvHtml.getElementsByClassName('property-card__title')[0].innerHTML.trim()
                            let tipoImovel = 2 //apartamento
                            if (titulo.toLowerCase().includes('casa')) {
                                tipoImovel = 1
                            } else if (titulo.toLowerCase().includes('terreno') || titulo.toLowerCase().includes('lote')) {
                                tipoImovel = 3
                            } else if (titulo.toLowerCase().includes('cobertura')) {
                                tipoImovel = 4
                            } else if (titulo.toLowerCase().includes('comercial') || titulo.toLowerCase().includes('sala/conjunto')) {
                                tipoImovel = 6
                            } else {
                                tipoImovel = 5
                            }
                            let descricaoTipoImovel = tipoImovel === 1 ? 'Casa' : 'Apartamento'
                            let area = Number(detalhes.getElementsByClassName('property-card__detail-area')[1].innerHTML.trim())

                            imvsProcessados.push({
                                url,
                                valorVenda,
                                valorOriginal,
                                endereco,
                                imagemUrl,
                                titulo,
                                tipoNegocio: 3,
                                tipoImovel,
                                descricaoTipoImovel,
                                area,
                                areaTerreno: area,
                                vendido: 0,
                                location: { lat: 0, lng: 0 },
                                bairro: 2
                            })

                        }
                    } catch (e) {
                        console.log('processaImoveisHtml')
                        console.log(e)
                    }
                }

                processaImoveisHtml(document.body.querySelectorAll('div[data-type="property"], div[data-type="nearby"]'))

                return { imvsProcessados, totalPagina };
            });

            if (imvsInfo.imvsProcessados.length < 36 - imvsInfo.totalPagina || pagina > 14) {
                imvsFinal = imvsFinal.concat(imvsInfo.imvsProcessados)
                console.log('Quebrando')
                console.log(imvsInfo.imvsProcessados.length)
                console.log(pagina)
                break
            } else {
                imvsFinal = imvsFinal.concat(imvsInfo.imvsProcessados)
            }
        }
        let postImv = []
        for (i = 0; i < imvsFinal.length; i++) {
            let imovel = imvsFinal[i]
            if (imovel.endereco !== null && imovel.endereco !== undefined && imovel.endereco !== '') {
                postImv.push({ ...imovel })
            }
        }

        console.log('postImv.length')
        console.log(postImv.length)

        try {
            let origem = '3'
            for (let j = 0; j < postImv.length; j++) {
                try {
                    let naBase = await supabase
                        .from('imoveis')
                        .select('*')
                        .like('url', '%' + postImv[j].url.split('-id-')[1])
                        .eq('origem_informacao', origem)

                    if (naBase === undefined) {
                        naBase = []
                    }

                    if (naBase.data.length === 0) {
                        let location = { lat: 0, lng: 0 }
                        let urlGeocode = 'https://maps.googleapis.com/maps/api/geocode/json?address=' + postImv[j].endereco.replaceAll(' ', '+') + '&key=AIzaSyBgqjErywYT_C7YU2XD_33UqhNXQkcbKfo'
                        console.log(i + ' Geocode - ' + urlGeocode)
                        let response = await axios.get(urlGeocode)
                        if (response.data.results.length > 0) {
                            location = response.data.results[0].geometry.location
                        }

                        console.log('Salvando ' + j)

                        const { error } = await supabase
                            .from('imoveis')
                            .insert({
                                url: postImv[j].url,
                                valor_venda: postImv[j].valorVenda,
                                valor_original: postImv[j].valorOriginal,
                                endereco: postImv[j].endereco,
                                imagem_url: postImv[j].imagemUrl,
                                titulo: postImv[j].titulo,
                                tipo_negocio: postImv[j].tipoNegocio,
                                tipo_imovel: postImv[j].tipoImovel,
                                area: postImv[j].area,
                                area_terreno: postImv[j].areaTerreno,
                                vendido: 0,
                                lat: location.lat,
                                lng: location.lng,
                                origem_informacao: origem,
                                bairro: postImv[j].bairro
                            })
                    } else {
                        console.log('Na Base ' + postImv[j].url)
                        const { error } = await supabase
                            .from('imoveis')
                            .update({
                                valor_venda: postImv[j].valorVenda,
                                valor_original: postImv[j].valorOriginal,
                                imagem_url: postImv[j].imagemUrl,
                                bairro: postImv[j].bairro,
                                data_atualizacao: (new Date()).toISOString()

                            }).eq('id', naBase.data[0].id)
                    }

                } catch (e) {
                    console.log('Erro supabase')
                    console.log(e)
                }

            }
            console.log('FIM')
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