module.exports = {
    parseAddress(address)
    {
        if(!address) return null

        const addressParts = address.split('|')

        const street = addressParts[0].trim() || null
        const district = addressParts[1]?.split(',')[1]?.trim() || null
        const zip = addressParts[1]?.split(',')[0]?.trim()?.split(' ')[0] || null
        const city = addressParts[1]?.split(',')[0]?.trim()?.split(' ')[1] || null

        return { street, zip, city, district }
    },

    parseContactNumber(contactNumber)
    {
        if(!contactNumber) return null

        contactNumber = contactNumber.toLowerCase().replace(/\s/g, '').replace(/-/g, '').replace(/\//g, '').replace(/:/g, '').replace(/\./g, '').replace(/\(/g, '').replace(/\)/g, '')

        // The first three digits are either "tel" or "fax"
        // Determine which one it is
        const prefix = contactNumber.substring(0, 3)
        const number = contactNumber.substring(3)

        return { type: prefix, number }
    },

    resolvePlaceholder(string, values)
    {
        for (const key in values)
        {
            string = string.replace(new RegExp(`{{${key}}}`, 'g'), values[key])
        }

        return string
    },
}