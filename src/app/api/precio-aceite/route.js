export async function GET() {
    try {
      // Intentamos Poolred - el mercado oficial del aceite de oliva en España
      const res = await fetch(
        'https://www.poolred.com/datos-de-mercado/aceite-de-oliva-virgen-extra/',
        { 
          headers: { 'User-Agent': 'Mozilla/5.0' },
          next: { revalidate: 3600 }
        }
      )
      const html = await res.text()
  
      // Buscar precio en formato X,XX o X.XX seguido de €
      const patrones = [
        /(\d+[,\.]\d+)\s*€\s*\/\s*kg/i,
        /precio[^0-9]*(\d+[,\.]\d+)/i,
        /(\d+[,\.]\d+)\s*euros?\s*(?:por|\/)\s*kg/i,
      ]
  
      for (const patron of patrones) {
        const match = html.match(patron)
        if (match) {
          const precio = parseFloat(match[1].replace(',', '.'))
          if (precio > 1 && precio < 20) { // sanity check
            return Response.json({ precio, fecha: new Date().toLocaleDateString('es-ES') })
          }
        }
      }
  
      return Response.json({ precio: null })
    } catch {
      return Response.json({ precio: null })
    }
  }