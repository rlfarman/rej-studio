import Image from 'next/image'

interface ContributorProperties {
  name: string
  title: string
  description: string
  image: string
}

function Contributor({
  name,
  title,
  description,
  image,
}: ContributorProperties) {
  return (
    <li>
      <div className="relative aspect-[3/2] sm:aspect-square">
        <Image
          src={image}
          alt={`Portrait of ${name}`}
          fill
          className="rounded-lg object-cover"
        />
      </div>
      <h2 className="mt-4 text-xl font-semibold">{name}</h2>
      <span className="text-gray-500 dark:text-gray-400">{title}</span>
      <p className="mt-2 text-gray-500 dark:text-gray-400">{description}</p>
    </li>
  )
}

export default function AboutUsPage() {
  return (
    <div className="grid grid-cols-1 gap-y-16">
      <div>
        <h2 className="text-2xl font-bold">About us</h2>
        <p className="mt-4 max-w-prose text-lg text-gray-500 dark:text-gray-400">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad
          minim veniam, quis nostrud exercitation ullamco laboris nisi ut
          aliquip ex ea commodo consequat.
        </p>
      </div>
      <ul className="grid max-w-md list-none grid-cols-1 gap-x-8 gap-y-16 sm:max-w-full sm:grid-cols-2">
        <Contributor
          name="Ryan Hsu"
          title="Project Lead"
          image="/images/ryan-hsu.jpg"
          description="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed ut tellus vitae nisl lacinia sagittis."
        />
        <Contributor
          name="Richie Farman"
          title="Software Engineer"
          image="/images/richie-farman.jpg"
          description="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed ut tellus vitae nisl lacinia sagittis."
        />
      </ul>
    </div>
  )
}
