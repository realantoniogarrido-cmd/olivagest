import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request) {
  try {
    const { prompt } = await request.json()
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    const analisis = JSON.parse(message.content[0].text)
    return Response.json({ analisis })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}