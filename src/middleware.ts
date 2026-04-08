import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // Token inválido/expirado — tratado como usuário não autenticado
  }

  const { pathname } = request.nextUrl;

  const publicPaths = ['/login', '/signup', '/recuperar-senha', '/aguardando-aprovacao'];
  const isPublicPath = publicPaths.some(p => pathname.startsWith(p));

  // Se o usuário está logado e tenta acessar uma página pública (como login), redireciona para o dashboard
  if (user && isPublicPath) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Se o usuário não está logado e tenta acessar uma página protegida, redireciona para o login
  if (!user && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest|manifest.json|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)',
  ],
}