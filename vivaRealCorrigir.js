const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const axios = require('axios')
const supa = require('@supabase/supabase-js')

const supabase = supa.createClient("https://urksffqejgoyacvhltis.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVya3NmZnFlamdveWFjdmhsdGlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4ODUxMDQsImV4cCI6MjA1MDQ2MTEwNH0.6LnuPY7mnKoHMMIuCYpZx72mBgcaauJDTKPhjZ10yxI");

puppeteer.use(StealthPlugin())

puppeteer.launch({ dumpio: true }).then(async browser => {

    const page = await browser.newPage();

    try {

        let imvsFinal = []
        //const { data, error } = await supabase.from('imoveis').select('*').lt('valor_venda', 1).eq('origem_informacao', 3)
        const { data, error } = await supabase.from('imoveis').select('*').like('imagem_url', '%pixel%').eq('origem_informacao', 3).eq("tipo_negocio", 3).limit(10)
        console.log('dados iniciais')
        console.log(data.length)

        for (let d = 0; d < data.length; d++) {
            let URL_SITE = data[d].url
            console.log('REGISTRO ' + d)
            console.log("alterando para pagina: " + URL_SITE)
            await page.goto(URL_SITE, {
                waitUntil: 'load'
            });
            await page.setBypassCSP(true)
            await page.waitForSelector('body');
            await page.waitForTimeout(5000);
            let imovelInfo = await page.evaluate(async () => {
                console.log('iniciando...')

                const processar = async () => {
                    let imagem_url_set = document.body.getElementsByClassName('carousel-photos--item')[0].querySelector('img').getAttribute('srcset').split(' ')[4]
                    let imagem_url = document.body.getElementsByClassName('carousel-photos--item')[0].querySelector('img').getAttribute('src')
                    let valor_venda = Number(document.body.getElementsByClassName('price-value-wrapper')[0].getElementsByClassName('price-info-value')[0].innerHTML.replaceAll('R$', '').replaceAll('&nbsp;', '').replaceAll(' ', '').replaceAll('\"', '').replaceAll('.', ''))
                    console.log(document.body.getElementsByClassName('price-value-wrapper')[0].getElementsByClassName('price-info-value')[0].innerHTML)
                    console.log(valor_venda)
                    if (valor_venda === NaN || valor_venda === null) {
                        valor_venda = 0;
                    }

                    let x = {
                        valor_venda: valor_venda,
                        valor_original: valor_venda,
                        imagem_url: (imagem_url === null || imagem_url === undefined || imagem_url === '') ? imagem_url_set : imagem_url,
                        //bairro: 2,
                        vendido: document.body.innerHTML.includes('Oops') ? 1 : 0
                    }

                    return x
                }
                try {
                    return await processar()
                } catch (e) {
                    console.log('processaImoveisHtml')
                    console.log(e)
                    return null
                }
            });

            if (imovelInfo !== null) {
                imvsFinal.push({ ...data[d], imagem_url: imovelInfo.imagem_url, valor_venda: imovelInfo.valor_venda, valor_original: imovelInfo.valor_original })
            }
        }

        let postImv = imvsFinal

        console.log('Dados finais')
        console.log(postImv)

        for (let j = 0; j < postImv.length; j++) {
            try {
                if(postImv[j].valor_venda > 0 && postImv[j].imagem_url !== null && postImv[j].imagem_url !== undefined ){
                    console.log('ATUALIZANDO ' + j)
                    const { error } = await supabase
                        .from('imoveis')
                        .update({
                            valor_venda: postImv[j].valor_venda,
                            valor_original: postImv[j].valor_original,
                            imagem_url: postImv[j].imagem_url,
                            bairro: postImv[j].bairro
                        }).eq('id', postImv[j].id)
                }
            } catch (e) {
                console.log('Erro supabase')
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