
const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const rawData = `
Antonio Fernandes	antonio.10313@edutec.sed.ms.gov.br	Ciências da Natureza
Barbara Lívia Nogueira da Silva Oliveira	barbara.423166@edutec.sed.ms.gov.br	Ciências da Natureza
Bruno de Andrade Martins	bruno.41796@edutec.sed.ms.gov.br	Ciências da Natureza
Claysson Xavier da Silva	claysson.127082@edutec.sed.ms.gov.br	Ciências da Natureza
Elice Garcia Manhães	elice.433575@edutec.sed.ms.gov.br	Ciências da Natureza
Elinson Rodrigo Bogarim de Almeida	elinson.491214@edutec.sed.ms.gov.br	Ciências da Natureza
Fabio Sobral Nogueira	fabio.466594@edutec.sed.ms.gov.br	Ciências da Natureza
Giovane Lima Vilhanueva	giovane.824676@edutec.sed.ms.gov.br	Ciências da Natureza
Janaina Felix da Silva	janaina.101124@edutec.sed.ms.gov.br	Ciências da Natureza
Juliana de Souza Peçanha	juliana.511396@edutec.sed.ms.gov.br	Ciências da Natureza
Larissa Porto Velasquez Eustáquio	larissa.815064@edutec.sed.ms.gov.br	Ciências da Natureza
Marcio Kazuo Masuda	marcio.43509@edutec.sed.ms.gov.br	Ciências da Natureza
Vinicius Martins Bento	vinicius.503700@edutec.sed.ms.gov.br	Ciências da Natureza
MARY CRISTIANE MIRANDA DA ROSA LIMA	mary.91402@edutec.sed.ms.gov.br	Ciências da Natureza
Arlete Vieira Ramos de Andrade	arlete.512465@edutec.sed.ms.gov.br	Educação Especial
Aurilene Carvalho dos Santos Cardoso	aurilene.10469@edutec.sed.ms.gov.br	Educação Especial
Jéssica Gonçalves do Nascimento	jessica.823789@edutec.sed.ms.gov.br	Educação Especial
Luciana Idelídia de Jesus Gomes Amaral	Luciana.823795@edutec.sed.ms.gov.br	Educação Especial
Priscila Menezes Lemes	priscila.816945@edutec.sed.ms.gov.br	Educação Especial
Silene da Silva	silene.89652@edutec.sed.ms.gov.br	Educação Especial
Sueli Luiza dos Santos	sueli.63423@edutec.sed.ms.gov.br	Educação Especial
Tais Ribeiro Duarte	tais.823997@edutec.sed.ms.gov.br	Educação Especial
Wanessa Parente dos Santos Ferreira	wanessa.2706@edutec.sed.ms.gov.br	Educação Especial
Marlene de Souza Vilas Boas Baena Castilho	marlene.465915@edutec.sed.ms.gov.br	Educação Profissional
Elias Borges de Campos	elias.496776@edutec.sed.ms.gov.br	Humanas
Fernando de Campos Barbosa Filho	fernando.817863@edutec.sed.ms.gov.br	Humanas
Hidem Ferreira Romeiro Franco	hidem.504072@edutec.sed.ms.gov.br	Humanas
Jacqueline dos Santos Albertine	jacqueline.423109@edutec.sed.ms.gov.br	Humanas
José Carlos dos Santos Brum	jose.55564@edutec.sed.ms.gov.br	Humanas
Luciana Lopes da Costa	luciana.6309@edutec.sed.ms.gov.br	Humanas
Odair Marques Pereira	odair.110182@edutec.sed.ms.gov.br	Humanas
Rafaela Bueno Miranda	rafaela.477386@edutec.sed.ms.gov.br	Humanas
Stella Carolina Carvalho Franco	stella.357416@edutec.sed.ms.gov.br	Humanas
Thiago Froes Acosta	thiago.29622@edutec.sed.ms.gov.br	Humanas
Willian Augusto Gonçalves Vormittag	willian.437461@edutec.sed.ms.gov.br	Humanas
Zilda Alves de Moura	zilda.61924@edutec.sed.ms.gov.br	Humanas
Andre Barbosa de Souza	andre.823716@edutec.sed.ms.gov.br	Linguagens
Andrey Monteiro Borges	andrey.430192@edutec.sed.ms.gov.br	Linguagens
Diogo Alexandre da Silva	diogo.466496@edutec.sed.ms.gov.br	Linguagens
Edvaldo Lourenço da Silva	edvaldo.107531@edutec.sed.ms.gov.br	Linguagens
Fabio Junior Vilhalba do Nascimento	fabio.509803@edutec.sed.ms.gov.br	Linguagens
Georlania Souza Barbosa	georlania.126180@edutec.sed.ms.gov.br	Linguagens
Isabela Barizon Bacarin	isabela.816662@edutec.sed.ms.gov.br	Linguagens
Janaina de Paula Barreto	janaina.495188@edutec.sed.ms.gov.br	Linguagens
Jeanne de Rezende Rocha	jeanne.437509@edutec.sed.ms.gov.br	Linguagens
Jefferson Pereira Berreto	jefferson.485106@edutec.sed.ms.gov.br	Linguagens
João Maria de Faria	joao.485683@edutec.sed.ms.gov.br	Linguagens
Juliana Souza Barbosa	juliana.5553@edutec.sed.ms.gov.br	Linguagens
Marcela Cardoso de Almeida Lombardi	marcela.445302@edutec.sed.ms.gov.br	Linguagens
Mateus Fernandes Adriano	mateus.50885@edutec.sed.ms.gov.br	Linguagens
Michelle Batista Gonçalves	michelle.479831@edutec.sed.ms.gov.br	Linguagens
Solange Duarte Araujo	solange.471542@edutec.sed.ms.gov.br	Linguagens
Tauane Janaina da Silva	tauane.823373@edutec.sed.ms.gov.br	Linguagens
Vanessa de Oliveira Bento de Assis	vanessa.0504@edutec.sed.ms.gov.br	Linguagens
Ygor Argulho Caramalac	ygor.496260@edutec.sed.ms.gov.br	Linguagens
Ana Cristina Aparecida de Souza	ana.484441@edutec.sed.ms.gov.br	Matemática
Gislene Lopes da Silva	gislene.28976@edutec.sed.ms.gov.br	Matemática
Jonathan Araujo Fernandes	jonathan.43386@edutec.sed.ms.gov.br	Matemática
Roger Lucas Argenta Mocinho	roger.494370@edutec.sed.ms.gov.br	Matemática
`;

async function migrate() {
    console.log('Iniciando importação de professores...');
    
    const lines = rawData.trim().split('\n');
    const professors = lines.map(line => {
        const [nome, email, area] = line.split('\t');
        return {
            nome: nome.trim(),
            email: email.trim(),
            area_conhecimento: area.trim(),
            cargo: 'Professor',
            habilitar_chamada_interna: true
        };
    });

    const res = await fetch(`${SUPABASE_URL}/rest/v1/professores`, {
        method: 'POST',
        headers: { 
            'apikey': SUPABASE_KEY, 
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(professors)
    });

    if (res.ok) {
        console.log(`Sucesso! ${professors.length} professores importados.`);
    } else {
        const err = await res.json();
        console.error('Erro na importação:', err);
    }
}

migrate();
