import clsx from 'clsx'
import Link from 'next/link'

interface SharedButtonProperties {
  children: React.ReactNode
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  className?: string
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
  'inline-block text-center text-white bg-sky-700 hover:bg-sky-800 font-medium rounded px-4 py-2 mr-2 dark:bg-sky-600 disabled:dark:bg-neutral-900 disabled:bg-neutral-400 disabled:cursor-not-allowed disabled:pointer-events-none'

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
  disabled = false,
  href,
  onClick,
  download = false,
  className,
}: ButtonProperties) {
  return (
    <>
      {href ? (
        <LinkButton href={href} download={download}>
          {children}
        </LinkButton>
      ) : (
        <button
          className={clsx(CLASSES, className)}
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
