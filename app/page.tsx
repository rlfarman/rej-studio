import { Provider } from '@/context/context'
import GeneSearch from './_components/gene-search'
import Button from '@/components/button'

export default function Home() {
  return (
    <Provider>
      <GeneSearch />
      <div className="pt-3">Or</div>
      <div className="pt-3">
        <Button href="/design-tool">Design your own</Button>
      </div>
    </Provider>
  )
}
