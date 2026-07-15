export interface CreateCustomerDTO {
  name: string;
  email: string;
  phone: string;
}

export interface Customer {
    id: string;
    name: string;
  email: string;
  phone: string;
  createdAt: Date;
}
