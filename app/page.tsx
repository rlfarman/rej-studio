import { Provider } from '@/context/context'
import GeneSplitterForm from '@/components/gene-splitter-form'

export default function Home() {
  return (
    <Provider>
      <div>
        <GeneSplitterForm />
      </div>
    </Provider>
  )
}
