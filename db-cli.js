const { JsonDB, Config } = require('node-json-db')
const prompt = require("prompt-sync")({ sigint: true })
const chalk = import("chalk").then(m => m.default)

let db, consoleColors



(async function () {
    consoleColors = await chalk

    async function log(output, color = 'white')
    {
        console.log(consoleColors[color](output))
    }
    
    db = new JsonDB(new Config("results", true, false, '/'))
    
    
    
    let exit = false
    while (!exit)
    {
        let id = prompt('ID: ')

        if (id === 'exit')
        {
            exit = true
            continue
        }
    


        result = await db.getData(`/results/${id}`)

        log('--------------------------------------', 'white')
        log(`${result.name}`, 'blue')
        log(`Kategorie: ${result.category ?? '---'}`, 'white')
        log(`Email: ${result.email ?? '---'}`, 'white')
        log(`Website: ${result.website ?? '---'}`, 'white')
        log('--------------------------------------', 'white')
    }
})()