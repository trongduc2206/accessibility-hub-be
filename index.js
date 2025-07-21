require('dotenv').config()

const { Pool } = require('pg')
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
const cors = require('cors')
app.use(cors())
app.use(express.json())

// const { OpenAI } = require("openai");
const { ChatOpenAI } = require("@langchain/openai")
const { ChatPromptTemplate, MessagesPlaceholder } = require("@langchain/core/prompts");
const { createOpenAIFunctionsAgent, AgentExecutor } = require("langchain/agents");
const { TavilySearchResults } = require("@langchain/community/tools/tavily_search");
const { GithubRepoLoader } = require("@langchain/community/document_loaders/web/github")

const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter")
const { MemoryVectorStore } = require("langchain/vectorstores/memory")
const { OpenAIEmbeddings } = require("@langchain/openai")
const { createRetrieverTool } = require("langchain/tools/retriever");
const { RetrievalQAChain } = require('langchain/chains');
const { DynamicTool } = require('langchain/tools');
const { initializeAgentExecutorWithOptions } = require('langchain/agents');




const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.7,
    apiKey: process.env.OPENAI_API_KEY,
});

const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a web accessibility expert with the latest knowledge."],
    // new MessagesPlaceholder("agent_scratchpad"),
    ["human", "Use this axe-core evaluation result: {result}. Use the violated HTML elements mentioned in the evaluation result, look into the corresponding code from the Github repo to answer the below question: How to specifically fix the violation of the accessibility the rule '{ruleId}' (only focus on this rule)?. If you cannot find anything from the code, just continue to answer the question based on your knowledge."],
    new MessagesPlaceholder("agent_scratchpad"),
]);

const splitter = RecursiveCharacterTextSplitter.fromLanguage('js', {
    chunkSize: 200,
    chunkOverlap: 20,
});

const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY_EMBEDDINGS });

const searchTool = new TavilySearchResults({
    apiKey: process.env.TAVILY_API_KEY,
});
const tools = [searchTool];

// const agent = await createOpenAIFunctionsAgent({
//   llm: model,
//   prompt: prompt,
//   tools: tools,
// });

// const openaiClient = new OpenAI({
//     apiKey: process.env.OPENAI_API_KEY,
// });

app.get('/', (request, response) => {
    response.send('<h1>Welcome to Accessibility Hub APIs!</h1>')
})

app.get('/rules-test', (request, response) => {
    const rules = "html-has-lang"
    response.send(rules)
})

app.get('/service/:serviceId', (request, response) => {
    const serviceId = request.params.serviceId;
    pool.query('SELECT * FROM service_rules WHERE service_id=$1', [serviceId], (error, results) => {
        if (error) {
            throw error
        }
        if (results.rows && results.rows.length > 0) {
            response.status(200).json(results.rows[0]);
        } else {
            response.status(404).send('Service ID not found');
        }
    })
})

app.post('/service-id', (request, response) => {
    const { serviceId } = request.body;
    pool.query('SELECT service_id FROM service_rules WHERE service_id=$1', [serviceId], (error, results) => {
        if (error) {
            throw error
        }
        if (results.rows && results.rows.length > 0) {
            response.status(200).json({ service_id: results.rows[0].service_id });
        } else {
            response.status(404).send('Service ID not found');
        }
    })
})

app.get('/rules/:id', (request, response) => {
    pool.query(`SELECT * FROM service_rules WHERE service_id='${request.params.id}' `, (error, results) => {
        if (error) {
            throw error
        }
        if (results.rows && results.rows.length > 0) {
            const rule = results.rows[0]
            response.send(rule.rule_ids)
        } else {
            response.status(404).send();
        }
    })
})

app.get('/ignore-pa11y-rules/:id', (request, response) => {
    pool.query(`SELECT ignore_pa11y_rule_ids FROM service_rules WHERE service_id='${request.params.id}' `, (error, results) => {
        if (error) {
            throw error
        }
        if (results.rows && results.rows.length > 0) {
            const ignoredRules = results.rows[0]
            response.send(ignoredRules.ignore_pa11y_rule_ids)
        } else {
            response.status(404).send();
        }
    })
})

app.post('/rules', (request, response) => {
    console.log(request.body)
    const {
        serviceName,
        ruleIds
    } = request.body

    const serviceId = serviceName.toLowerCase().replace(/\s+/g, '') + Math.floor(10000 + Math.random() * 90000);
    console.log('serviceId:', serviceId);

    pool.query('INSERT INTO service_rules (service_name, service_id, rule_ids) VALUES ($1, $2, $3) RETURNING *', [serviceName, serviceId, ruleIds], (error, results) => {
        if (error) {
            throw error
        }
        console.log(results.rows[0])
        response.status(201).send(`${results.rows[0].service_id}`)
    })
})

app.post('/service', (request, response) => {
    const { serviceName, githubUrl } = request.body;
    const serviceId = serviceName.toLowerCase().replace(/\s+/g, '') + Math.floor(10000 + Math.random() * 90000);
    pool.query('INSERT INTO service_rules (service_name, service_id, github_url) VALUES ($1, $2, $3) RETURNING *', [serviceName, serviceId, githubUrl], (error, results) => {
        if (error) {
            throw error
        }
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
        response.status(200).send(`${results.rows[0].service_id}`)
    })
})

app.put('/ignore-pa11y-rules/:id', (request, response) => {
    console.log(request.body)
    const {
        ruleIds
    } = request.body

    pool.query('UPDATE service_rules SET ignore_pa11y_rule_ids=$2 WHERE service_id=$1 RETURNING *', [request.params.id, ruleIds], (error, results) => {
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

app.post('/extract-rule-ids', (request, response) => {
    const { output, serviceId } = request.body;

    if (!output || !serviceId) {
        return response.status(400).send('No output or service_id provided');
    }

    const ruleIds = [];
    const regex = /Violation of "([^"]+)"/g;
    let match;

    while ((match = regex.exec(output)) !== null) {
        ruleIds.push(match[1]);
    }

    const ruleIdsString = ruleIds.join(',');

    pool.query('UPDATE service_rules SET manual_failed_rule_ids=$2 WHERE service_id=$1 RETURNING *', [serviceId, ruleIdsString], (error, results) => {
        if (error) {
            throw error
        }
        response.status(200).json({ service_id: results.rows[0].service_id, manual_failed_rule_ids: results.rows[0].manual_failed_rule_ids });
    })
})

app.post('/extract-rule-codes', (request, response) => {
    const { output, serviceId } = request.body;

    if (!output || !serviceId) {
        return response.status(400).send('No output or service_id provided');
    }

    const ruleCodes = [];
    const regex = /├── (WCAG2AA\.[^\s]+)/g; // Regex to match rule codes
    let match;

    while ((match = regex.exec(output)) !== null) {
        ruleCodes.push(match[1]);
    }
    const uniqueRuleCodes = [...new Set(ruleCodes)];
    console.log('uniqueRuleCodes:', uniqueRuleCodes);

    const ruleCodesString = uniqueRuleCodes.join(',');

    pool.query('UPDATE service_rules SET manual_failed_rule_ids_pa11y=$2 WHERE service_id=$1 RETURNING *', [serviceId, ruleCodesString], (error, results) => {
        if (error) {
            throw error
        }
        response.status(200).json({ service_id: results.rows[0].service_id, manual_failed_rule_codes: results.rows[0].manual_failed_rule_ids_pa11y });
    })
});

app.post('/axe-full-manual', (request, response) => {
    const { output, serviceId } = request.body;

    if (!output || !serviceId) {
        return response.status(400).send('No output or service_id provided');
    }

    pool.query('UPDATE service_rules SET axe_full_manual_result=$2 WHERE service_id=$1 RETURNING *', [serviceId, output], (error, results) => {
        if (error) {
            throw error
        }
        response.status(200).json({ service_id: results.rows[0].service_id });
    })
})


app.get('/manual-failed-rule-ids/:id', (request, response) => {
    const serviceId = request.params.id;

    pool.query('SELECT manual_failed_rule_ids, manual_failed_rule_ids_pa11y  FROM service_rules WHERE service_id=$1', [serviceId], (error, results) => {
        if (error) {
            throw error
        }
        if (results.rows && results.rows.length > 0) {
            const ruleIdsString = results.rows[0].manual_failed_rule_ids;
            const ruleIdsArray = ruleIdsString ? ruleIdsString.split(',') : [];
            const ruleCodesString = results.rows[0].manual_failed_rule_ids_pa11y;
            const ruleCodesArray = ruleCodesString ? ruleCodesString.split(',') : [];
            response.status(200).json({ service_id: serviceId, manual_failed_rule_ids: ruleIdsArray, manual_failed_rule_ids_pa11y: ruleCodesArray });
        } else {
            response.status(404).send('Service ID not found');
        }
    })
})

app.get('/axe-full-manual/:id', (request, response) => {
    const serviceId = request.params.id;
    pool.query('SELECT axe_full_manual_result FROM service_rules WHERE service_id=$1', [serviceId], (error, results) => {
        if (error) {
            throw error
        }
        if (results.rows && results.rows.length > 0) {
            const axeFullManualResult = results.rows[0].axe_full_manual_result;
            response.status(200).json({ service_id: serviceId, axe_full_manual_result: axeFullManualResult });
        } else {
            response.status(404).send('Service ID not found');
        }
    })
})

// app.get('/axe-instruction/:id', async (request, response) => {
//     const serviceId = request.params.id;

//     let axeInstructionInDb = false;
//     pool.query('SELECT axe_instruction FROM service_rules WHERE service_id=$1', [serviceId], async (error, results) => {
//         if (error) {
//             throw error
//         }
//         if (results.rows && results.rows.length > 0) {
//             const axeInstruction = results.rows[0].axe_instruction;
//             if (axeInstruction) {
//                 axeInstructionInDb = true;
//             }
//             response.status(200).json({ service_id: serviceId, axe_instruction: axeInstruction });
//             return;
//         }
//     })


//     if(!axeInstructionInDb) {
//         pool.query('SELECT axe_full_manual_result FROM service_rules WHERE service_id=$1', [serviceId], async (error, results) => {
//             if (error) {
//                 throw error
//             }
//             if (results.rows && results.rows.length > 0) {
//                 const axeFullManualResult = results.rows[0].axe_full_manual_result;
//                 const instruction = await openaiClient.responses.create({
//                     model: "gpt-4o-mini",
//                     instructions: "Talk like a web accessibility expert.",
//                     input: `How to fix the accessibility issues from this evaluation result: ${axeFullManualResult}?`,
//                 });
//                 console.log("Response:", instruction);
//                 pool.query('UPDATE service_rules SET axe_instruction=$2 WHERE service_id=$1 RETURNING *', [serviceId, instruction.output_text], (error, results) => {
//                     if (error) {
//                         throw error
//                     }
//                 });
//                 response.status(200).json({ service_id: serviceId, instruction: instruction.output_text });
//             } else {
//                 response.status(404).send('Service ID not found');
//             }
//         })
//     }
// })

// app.get('/axe-instruction/:id', async (request, response) => {
//     const serviceId = request.params.id;

//     try {
//         // Query for existing axe_instruction
//         // const instructionResult = await pool.query(
//         //   'SELECT axe_instruction FROM service_rules WHERE service_id = $1',
//         //   [serviceId]
//         // );

//         // if (instructionResult.rows.length > 0) {
//         //   const axeInstruction = instructionResult.rows[0].axe_instruction;

//         //   if (axeInstruction) {
//         //     // ✅ Already exists — return it
//         //     return response.status(200).json({ serviceId: serviceId, axeInstruction });
//         //   }
//         // }

//         // If not found or null, get full manual result
//         const fullResult = await pool.query(
//             'SELECT axe_full_manual_result FROM service_rules WHERE service_id = $1',
//             [serviceId]
//         );

//         if (fullResult.rows.length === 0) {
//             return response.status(404).send('Service ID not found');
//         }

//         const axeFullManualResult = fullResult.rows[0].axe_full_manual_result;

//         const instruction = await openaiClient.responses.create({
//             model: "gpt-4o-mini",
//             instructions: "Talk like a web accessibility expert.",
//             input: `How to fix the accessibility issues from this evaluation result: ${axeFullManualResult}?`,
//         });

//         // Save the new instruction in DB
//         await pool.query(
//             'UPDATE service_rules SET axe_instruction = $2 WHERE service_id = $1',
//             [serviceId, instruction.output_text]
//         );

//         return response.status(200).json({
//             service_id: serviceId,
//             instruction: instruction.output_text
//         });

//     } catch (error) {
//         console.error("Server error:", error);
//         return response.status(500).send('Internal Server Error');
//     }
// });

const vectorStoreCache = new Map();

app.post('/instruction-chain/:id', async (request, response) => {
    const serviceId = request.params.id;
    const { ruleId, githubUrl, githubBranch } = request.body;
    if (!serviceId) {
        return response.status(400).send('No service_id provided');
    }
    if (!ruleId) {
        return response.status(400).send('No ruleId provided');
    }
    let vectorStore;
    let retriever;
    try {
        if (githubUrl) {
            if (!vectorStoreCache.has(githubUrl)) {
                console.log("not found in cache, loading from github:", githubUrl);
                const loader = new GithubRepoLoader(
                    githubUrl,
                    {
                        accessToken: process.env.GITHUB_ACCESS_TOKEN,
                        branch: githubBranch || "main",
                        recursive: true,
                        unknown: "warn",
                        maxConcurrency: 2, // Defaults to 2
                        ignoreFiles: [
                            "package-lock.json",
                            "yarn.lock",
                            "package.json",
                            "README.md",
                            ".env.local",
                            ".env",
                            ".gitignore",
                        ],
                        ignorePaths: [
                            "node_modules",
                            "dist",
                            "build",
                            ".git",
                            "package-lock.json",
                            "yarn.lock",
                            "README.md",
                            "*.svg",
                            "*.png",
                            "*.jpg",
                            "*.gif",
                            ".env",
                            ".env.local",
                            ".gitignore",
                            "package.json",
                            "public",
                            ".github",
                            "*.json",
                            "*.md",
                            ".cjs",
                            ".mjs",
                            "*.config.js",
                            "**/assets/**",
                            "**/static/**",
                            "assets",
                            "static",
                            "**/back-end/**",
                        ]
                    }
                );

                const docs = await loader.load();

                console.log(`Loaded documents from GitHub repository.`);

                const splitDocs = await splitter.splitDocuments(docs);

                console.log(`Split documents into ${splitDocs.length} chunks.`);

                vectorStore = await MemoryVectorStore.fromDocuments(
                    splitDocs,
                    embeddings
                );

                console.log(`Created vector store with ${vectorStore.index} vectors.`);

                console.log('create store', vectorStore)

                console.log(`Created vector store vectors.`);
                vectorStoreCache.set(githubUrl, vectorStore);
            } else {
                console.log("found in cache, using existing vector store for:", githubUrl);
                vectorStore = vectorStoreCache.get(githubUrl);
            }

            retriever = vectorStore.asRetriever({
                k: 5,
            });

            const retrieverTool = createRetrieverTool(retriever, {
                name: "code_search",
                description:
                    "Use this tool to get more information about the codebase so that you can provide more practical instructions to fix the accessibility issues. The input should be a question about the codebase, and the output will be a list of relevant code snippets.",
            });

            tools.push(retrieverTool);
        }
    } catch (error) {
        console.error("Error loading GitHub repository:", error);
    }

    // const agent = await createOpenAIFunctionsAgent({
    //     llm: model,
    //     prompt: prompt,
    //     tools: tools,
    // });

    // const agentExecutor = new AgentExecutor({
    //     agent,
    //     tools: tools,
    // });

    // const agentExecutor = AgentExecutor.fromAgentAndTools({
    //     agent,
    //     tools: tools,
    // });

    const evaluationResult = await pool.query(
        'SELECT axe_full_manual_result FROM service_rules WHERE service_id = $1',
        [serviceId]
    );

    if (evaluationResult.rows.length === 0) {
        return response.status(404).send('Service ID not found');
    }

    const axeFullManualResult = evaluationResult.rows[0].axe_full_manual_result;

    if (retriever !== undefined && retriever !== null) {
        console.log("Using retriever for instruction generation");
        const chain = RetrievalQAChain.fromLLM(model, retriever)
        // const formattedMessages = prompt.formatMessages({
        //     result: axeFullManualResult,
        //     ruleId: ruleId,
        // });
        // console.log("Formatted messages:", formattedMessages);
        const promptTest = `
You are an expert in web accessibility. Based on the following axe-core accessibility evaluation report, 
and the corresponding code snippets from the GitHub repo, provide detailed and specific instructions for how to fix each accessibility violation. 

Report:
${axeFullManualResult}

Focus on the rule: ${ruleId}
`;
        const result = await chain.invoke({
            // query: formattedMessages.map(m => m.content).join('\n\n') 
            query: promptTest,
        });
        return response.status(200).json({
            service_id: "instruction-agent",
            instruction: result.text,
        });
    }

    console.log("retriever is undefined, using agent executor for instruction generation");
    const agentResponse = await agentExecutor.invoke({
        ruleId: ruleId,
        result: axeFullManualResult,
    });

    return response.status(200).json({
        service_id: "instruction-agent",
        instruction: agentResponse.output,
        // instruction: "test"
    });
});

app.post('/instruction-agent/:id', async (req, res) => {
    const serviceId = req.params.id;

    const { githubUrl, ruleId, githubBranch } = req.body;

    if (!serviceId) {
        return res.status(400).json({ error: 'Missing serviceId' });
    }

    if (!ruleId) {
        return res.status(400).json({ error: 'Missing githubUrl' });
    }

    const evaluationResult = await pool.query(
        'SELECT axe_full_manual_result FROM service_rules WHERE service_id = $1',
        [serviceId]
    );

    if (evaluationResult.rows.length === 0) {
        return response.status(404).send('Service ID not found');
    }

    const axeFullManualResult = evaluationResult.rows[0].axe_full_manual_result;

    try {
        // Step 1: Load GitHub code
        if (githubUrl) {
            let vectorStore;
            if (!vectorStoreCache.has(githubUrl)) {
                const loader = new GithubRepoLoader(githubUrl, {
                    accessToken: process.env.GITHUB_ACCESS_TOKEN,
                    branch: githubBranch || "main",
                    recursive: true,
                    unknown: "warn",
                    ignoreFiles: [
                        "package-lock.json",
                        "yarn.lock",
                        "package.json",
                        "README.md",
                        ".env.local",
                        ".env",
                        ".gitignore",
                    ],
                    ignorePaths: [
                        "node_modules",
                        "dist",
                        "build",
                        ".git",
                        "package-lock.json",
                        "yarn.lock",
                        "README.md",
                        "*.svg",
                        "*.png",
                        "*.jpg",
                        "*.gif",
                        ".env",
                        ".env.local",
                        ".gitignore",
                        "package.json",
                        "public",
                        ".github",
                        "*.json",
                        "*.md",
                        ".cjs",
                        ".mjs",
                        "*.config.js",
                        "**/assets/**",
                        "**/static/**",
                        "assets",
                        "static",
                        "**/back-end/**",
                    ]
                });
                const docs = await loader.load();

                // Step 2: Chunk + embed
                const splitter = new RecursiveCharacterTextSplitter({
                    chunkSize: 1000,
                    chunkOverlap: 100,
                });
                const splitDocs = await splitter.splitDocuments(docs);

                vectorStore = await MemoryVectorStore.fromDocuments(
                    splitDocs,
                    embeddings,
                );
                console.log('create vector store')
                vectorStoreCache.set(githubUrl, vectorStore);
            } else {
                console.log("Using cached vector store for:", githubUrl);
                vectorStore = vectorStoreCache.get(githubUrl);
            }


            const retriever = vectorStore.asRetriever();

            // Step 3: Define search tool
            const searchCodeTool = new DynamicTool({
                name: 'search_codebase',
                description: 'Search the website codebase for relevant code using a natural language query.',
                func: async (query) => {
                    const results = await retriever.getRelevantDocuments(query);
                    return results.map((doc) => `From ${doc.metadata.source}:\n${doc.pageContent}`).join('\n\n');
                },
            });

            const task = `
    You are an expert in fixing web accessibility issues.
    Below is an axe-core accessibility evaluation report. Your job is to:
    1. Focus on the violated rule with ID ${ruleId}.
    2. Use the "search_codebase" tool to locate relevant code that causes or relates to the violated rule.
    3. Give the developer precise, file-specific instructions to fix the specific rule with ID ${ruleId}.
    Do not invent issues. Always ground answers in the report and actual code retrieved from the tool.
    axe-core Report:
    -------------------
    ${axeFullManualResult}
            `.trim();

            const executor = await initializeAgentExecutorWithOptions(
                [searchCodeTool],
                model,
                {
                    agentType: 'openai-functions',
                    verbose: true,
                }
            );

            const result = await executor.invoke({ input: task });

            return res.json({ output: result.output });
        } else {
            console.log("No GitHub URL provided, using axe report directly");
            const simplePrompt = `
You are a senior accessibility expert.
Below is an axe-core accessibility report. Based on this report, provide detailed instructions to fix the violated rule with ID ${ruleId}.
Axe Report:
--------
${axeFullManualResult}
      `.trim();

            const response = await model.invoke(simplePrompt);
            console.log("Response from model:", response);
            return res.json({ output: response.content});
        }


    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Agent execution failed' });
    }
});

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})