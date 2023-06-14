import Link from 'next/link'

interface SharedButtonProperties {
  children: React.ReactNode
  type?: 'button' | 'submit' | 'reset'
  variant?: 'primary' | 'secondary' | 'tertiary'
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
}

type LinkButtonProperties = SharedButtonProperties & {
  href: string
  onClick?: never
  download?: boolean
}

type ActionButtonProperties = SharedButtonProperties & {
  href?: never
  download?: never
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
}

type SubmitButtonProperties = SharedButtonProperties & {
  type: 'submit'
  download?: never
  href?: never
  onClick?: never
}

type ButtonProperties =
  | LinkButtonProperties
  | ActionButtonProperties
  | SubmitButtonProperties

const CLASSES =
  'inline-block text-white bg-sky-700 hover:bg-sky-800 focus:ring-4 focus:ring-sky-300 font-medium rounded text-sm px-4 py-2 mr-2 dark:bg-sky-600 dark:hover:bg-sky-700 focus:outline-none dark:focus:ring-sky-800'

function getLinkButtonContainer(
  href: string,
  download: boolean
): 'a' | typeof Link {
  if (!download && href.startsWith('/')) {
    return Link
  }
  return 'a'
}

function LinkButton({
  children,
  href,
  download = false,
}: LinkButtonProperties) {
  const ButtonContainer = getLinkButtonContainer(href, download)
  return (
    <ButtonContainer
      className={CLASSES}
      href={href}
      role="button"
      download={download}
    >
      {children}
    </ButtonContainer>
  )
}

export default function Button({
  children,
  type = 'button',
  variant = 'primary',
  size = 'medium',
  disabled = false,
  href,
  onClick,
  download = false,
}: ButtonProperties) {
  return (
    <>
      {href ? (
        <LinkButton href={href} download={download}>
          {children}
        </LinkButton>
      ) : (
        <button
          className={CLASSES}
          type={type}
          onClick={onClick}
          disabled={disabled}
        >
          {children}
        </button>
      )}
    </>
  )
}
