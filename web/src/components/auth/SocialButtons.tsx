import { oauthSignIn } from '../../lib/auth/actions'

/** "Continue with Google / Microsoft", with the divider that comes after them. */
export function SocialButtons({ from }: { from: string }) {
  return (
    <>
      <div className="social">
        <form action={oauthSignIn.bind(null, 'google', from)}>
          <button className="btn btn--social" data-source="google">
            <span className="source-dot" aria-hidden />
            Continue with Google
          </button>
        </form>
        <form action={oauthSignIn.bind(null, 'microsoft-entra-id', from)}>
          <button className="btn btn--social" data-source="microsoft">
            <span className="source-dot" aria-hidden />
            Continue with Microsoft
          </button>
        </form>
      </div>
      <div className="divider" role="separator">
        or
      </div>
    </>
  )
}
