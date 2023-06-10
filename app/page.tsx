import { Provider } from '@/context/context'
import GeneSplitterList from './gene-splitter-list'
import GeneSplitterInput from './gene-splitter-input'
import GeneSplitterForm from './gene-splitter-form'

export default function Home() {
  return (
    <Provider>
      <div>
        <GeneSplitterForm />
      </div>
    </Provider>
  )
}
