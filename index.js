require('dotenv').config()

const {Pool} = require('pg')
const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE,
    ssl: {
        rejectUnauthorized: false, // May need to be `true` in production
      }
})
// client.connect().then(() => {console.log("connect to database")}).catch((error) => {console.log(error)})
pool.connect((err) => {
    if (err) {
      console.log(err);
      return;
    }
    console.log('connected to database');
  });
const express = require('express')
const app = express()
app.use(express.json())

app.get('/', (request, response) => {
    response.send('<h1>Welcome to Accessibility Hub APIs!</h1>')
})

app.get('/rules-test', (request, response) => {
    const rules = "html-has-lang"
    response.send(rules)
})

app.get('/rules/:id', (request, response) => {
    pool.query(`SELECT * FROM service_rules WHERE service_id='${request.params.id}' `, (error, results) => {
        if (error) {
          throw error
        }
        response.status(200).json(results.rows)
      })
})

app.post('/rules', (request, response) => {
    console.log(request.body)
    const {
        serviceId,
        ruleIds
    } = request.body

    pool.query('INSERT INTO service_rules (service_id, rule_ids) VALUES ($1, $2) RETURNING *', [serviceId, ruleIds], (error, results) => {
        if (error) {
          throw error
        }
        console.log(results.rows[0])
        response.status(201).send(`${results.rows[0].service_id}`)
      })
})

app.put('/rules/:id', (request, response) => {
    console.log(request.body)
    const {
        ruleIds
    } = request.body

    pool.query('UPDATE service_rules SET rule_ids=$2 WHERE service_id=$1 RETURNING *', [request.params.id, ruleIds], (error, results) => {
        if (error) {
          throw error
        }
        console.log(results.rows[0])
        response.status(200).send(`${results.rows[0].service_id}`)
      })
})

app.delete('/rules/:id', (request, response) => {
    pool.query('DELETE FROM service_rules WHERE service_id=$1 RETURNING *', [request.params.id], (error, results) => {
        if (error) {
          throw error
        }
        response.status(200).send(`${request.params.id}`)
      })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})