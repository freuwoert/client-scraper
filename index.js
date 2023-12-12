const playwright = require('playwright')
const { JsonDB, Config} = require('node-json-db')
const crypto = require('crypto')
const chalk = import("chalk").then(m => m.default)
const { parseAddress, parseContactNumber, resolvePlaceholder } = require('./utils.js')

let browser, context, page, log, chalk_, db, config



(async function() {
    // Setup Playwright
    browser = await playwright.chromium.launch()
    context = await browser.newContext()
    page = await context.newPage()

    // Setup logging
    chalk_ = await chalk
    log = (output, color = 'white') => console.log(chalk_[color](output))

    // Setup database
    db = new JsonDB(new Config("results", true, false, '/'))
    db.push('/resultCount', 0)
    db.push('/results', {})

    // Load config
    config = {
        search: 'Fleischerei',
        provider: {
            dasoertliche: {
                name: 'Das Örtliche',
                resultProbeUrl: 'https://www.dasoertliche.de/?form_name=search_nat&kw={{search}}',
                resultUrl: 'https://www.dasoertliche.de/?form_name=search_nat&kw={{search}}&recFrom={{resultsFrom}}',
                resultsPerPage: 25,
            }
        },
        crawling: {
            maxResults: 25,
            minRequestDelay: 1000,
            maxRequestDelay: 3000,
        },
    }
    
    // Start crawling
    await crawlDasOertliche()

    await crawlDetails()
    
    // Close browser
    await browser.close()
})()



async function resultCount()
{
    return await db.getData('/resultCount')
}

async function storeResult(result)
{
    await db.push(`/results/${result.id}`, result)
    await db.push('/resultCount', (await getResults()).length)
}

async function getResults()
{
    return Object.values(await db.getData('/results'))
}

async function getResult(id)
{
    return await db.getData(`/results/${id}`)
}

async function updateResult(id, result)
{
    await db.push(`/results/${id}`, result)
}



async function crawlDasOertliche()
{
    let resultsFrom = 1



    // First me make a search for "Fleischerei" in Germany to get the appr. total amount of results
    await page.goto(resolvePlaceholder(config.provider.dasoertliche.resultProbeUrl, {search: config.search}))
    
    // Here we get the amount of results
    const resultAmount = parseInt(await page.locator('.sttrefferanz').first().innerText())
    log(`Found approx. ${resultAmount} results`, 'bold')
    log(`Crawling ${Math.min(resultAmount, config.crawling.maxResults)} results`, 'bold')



    // While we have not reached the maximum amount of results and the maximum amount of results we want to crawl
    while (resultsFrom <= resultAmount && resultsFrom <= config.crawling.maxResults)
    {
        // Wait a random amount of time
        let waitTime = Math.floor(Math.random() * (config.crawling.maxRequestDelay - config.crawling.minRequestDelay + 1)) + config.crawling.minRequestDelay

        log(`Waiting ${(waitTime / 1000).toFixed(2)}s`, 'yellow')

        await page.waitForTimeout(waitTime)

        // Go to result page
        page.goto(resolvePlaceholder(config.provider.dasoertliche.resultUrl, {search: config.search, resultsFrom}))

        // Get all results
        const resultElements = await page.locator('#hitwrap > .hit').all()
    
        let resultBatchCount = 0

        for (const result of resultElements)
        {
            // Get name
            const name = await result.locator('h2 > a').first().innerText()
    
            // Get link to detail page
            const link = await result.locator('h2 > a').first().getAttribute('href')
    
            // Get category
            const category = await result.locator('.splitter .category').first().innerText()
            
            // Get and parse address
            const address = parseAddress((await result.locator('.splitter address').first().innerText()).split('\n').filter((line) => line !== '').join('|'))
            
            // Get and parse contact numbers (e.g. phone, fax, mobile)
            const contactNumbers = await result.locator('.splitter .phoneblock').all()
            const numbers = []
            for (const contactNumber of contactNumbers)
            {
                numbers.push(parseContactNumber(await contactNumber.locator('span:not([class])').innerText()))
            }

            // Generate hash
            let hash = crypto.createHash('md5').update(link).digest('hex')
            
            log(`Crawled: ${hash} ${name}`)

            // Add result to database
            await storeResult({
                id: hash,
                name,
                link,
                category,
                address,
                numbers,
                website: null,
                email: null,
                provider: 'dasoertliche',
                status: 'detail-crawl-pending'
            })

            // Increase result batch count
            resultBatchCount++
        }

        log(`Added ${resultBatchCount} results (${await resultCount()} total)...`, 'green')

        // Go to next page
        resultsFrom += config.resultsPerPage
    }

    log(`Finished with ${await resultCount()} results!`, 'bgBlue')
}



async function crawlDetails()
{
    let results

    // Get from database
    results = await getResults()

    // Filter for results that have not been crawled yet
    results = results.filter((result) => result.status === 'detail-crawl-pending')

    for (result of results)
    {
        // Wait a random amount of time
        let waitTime = Math.floor(Math.random() * (config.crawling.maxRequestDelay - config.crawling.minRequestDelay + 1)) + config.crawling.minRequestDelay
    
        log(`Waiting ${(waitTime / 1000).toFixed(2)}s`, 'yellow')
        
        await page.waitForTimeout(waitTime)
        
        log(`Crawling details for ${result.id} ${result.name}...`, 'bold')
    
        // Go to detail page
        await page.goto(result.link)

        // Get website
        const websiteLink = await page.locator('.det_addrcont .lnks a.www')
        let website = ''
        if (await websiteLink.isVisible()) { website = await websiteLink.innerText() }
        
        // Get email
        const emailLink = await page.locator('.det_addrcont .lnks a.mail')
        let email = ''
        if (await emailLink.isVisible()) { email = await emailLink.innerText() }
    
        // Get email
        // const email = await page.locator('.det_addrcont .lnks > a.mail > span').first().innerText()
    
        // Update result
        await updateResult(result.id, {
            ...result,
            website,
            email,
            status: 'detail-crawled'
        })
    
        log(`Finished!`, 'bgGreen')
    }
}