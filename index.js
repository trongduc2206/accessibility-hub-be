const express = require('express')
const app = express()

app.get('/', (request, response) => {
    response.send('<h1>Welcome to Accessibility Hub APIs!</h1>')
})

app.get('/rules', (request, response) => {
    const rules = ["html-has-lang"]
    const data = {
        rules
    }
    response.json(data)
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})