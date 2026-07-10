export interface CreateCustomerDTO {
  fullName: string;
  email: string;
  phone: string;
}

export interface Customer {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  createdAt: Date;
}