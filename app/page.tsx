import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-gradient-to-r from-blue-500 to-indigo-600">
      <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center text-white">
        <h1 className="text-6xl font-bold">
          Bem-vindo ao <span className="text-yellow-300">PontoG3</span>
        </h1>
        <p className="mt-3 text-2xl">
          Controle de Ponto Inteligente (AI First)
        </p>

        <div className="mt-8 flex gap-4">
          <Link href="/login" className="px-8 py-3 bg-white text-indigo-600 rounded-lg font-bold hover:bg-gray-100 transition duration-300">
            Acessar Sistema
          </Link>
        </div>
      </main>
    </div>
  )
}
