export type ContainerSize = '20' | '40' | '40HC'

export type Container = {
  c_number: string
  seal: string | null
  container_size: ContainerSize | null
  avail_from: string | null
  avail_to: string | null
}
